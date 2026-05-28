// services/treeEngine.js
import Relationship from "../models/Relationship.js";
import User from "../models/User.js";
import Event from "../models/Event.js";
import TreeHistory from "../models/TreeHistory.js";
import Organizer from "../models/Organizer.js";

const GEN_LABELS = {
  4: 'GEN +4 · Great-Great Grandparents',
  3: 'GEN +3 · Great Grandparents',
  2: 'GEN +2 · Grandparents',
  1: 'GEN +1 · Parents & Extended Family',
  0: 'GEN 0 · Self & Siblings',
  '-1': 'GEN -1 · Children',
  '-2': 'GEN -2 · Grandchildren',
  '-3': 'GEN -3 · Great Grandchildren',
};

// Mermaid edge style per backend relationType
const EDGE_MAP = {
  parent:          '-->',  grandparent:    '-->',
  child:           '<--',  grandchild:     '<--',
  nephew:          '<--',  niece:          '<--',
  uncle:           '-->',  aunt:           '-->',
  spouse:          '---',
  sibling:         '-.->',  cousin:        '-.->',
  'step-parent':   '-.->',  'step-child':  '-.->',
  'step-sibling':  '-.->',  friend:        '-.->',
  'father-in-law': '-.->',  'mother-in-law': '-.->',
  'brother-in-law':'-.->',  'sister-in-law': '-.->',
};

// How much a neighbour's generation shifts relative to the current node
// direction 'forward': edge goes FROM current TO neighbour (person1 → person2)
// direction 'reverse': edge goes FROM neighbour TO current (person2 → person1)
const GEN_DELTA = {
  parent:          { forward: -1, reverse: +1 },
  child:           { forward: +1, reverse: -1 },
  grandparent:     { forward: -2, reverse: +2 },
  grandchild:      { forward: +2, reverse: -2 },
  uncle:           { forward: -1, reverse: +1 },
  aunt:            { forward: -1, reverse: +1 },
  nephew:          { forward: +1, reverse: -1 },
  niece:           { forward: +1, reverse: -1 },
  'step-parent':   { forward: -1, reverse: +1 },
  'step-child':    { forward: +1, reverse: -1 },
  'father-in-law': { forward: -1, reverse: +1 },
  'mother-in-law': { forward: -1, reverse: +1 },
  spouse:          { forward:  0, reverse:  0 },
  sibling:         { forward:  0, reverse:  0 },
  cousin:          { forward:  0, reverse:  0 },
  friend:          { forward:  0, reverse:  0 },
  'step-sibling':  { forward:  0, reverse:  0 },
  'brother-in-law':{ forward:  0, reverse:  0 },
  'sister-in-law': { forward:  0, reverse:  0 },
};

class TreeEngine {
  
  // Validate relationship before adding
  static async validateRelationship(eventId, person1Id, person2Id, relationType, addedBy, familySide = "common") {
    const errors = [];
    
    const event = await Event.findById(eventId);
    if (!event) {
      errors.push("Event not found");
      return { isValid: false, errors };
    }
    
    // Check user addition limit (only for regular users, not org/admin or main persons)
    const addingUser = await User.findById(addedBy);
    const isMainPerson = (event.treeConfig?.mainPersonId?.toString() === addedBy) ||
                         (event.treeConfig?.groomId?.toString() === addedBy) ||
                         (event.treeConfig?.brideId?.toString() === addedBy);

    if (!isMainPerson && addingUser && !addingUser.canAddPerson()) {
      errors.push("You have reached the maximum limit of 4 people you can add");
    }
    
    // Check for duplicate relationship
    const existing = await Relationship.findOne({
      eventId,
      familySide,
      $or: [
        { person1: person1Id, person2: person2Id },
        { person1: person2Id, person2: person1Id }
      ]
    });
    
    if (existing) {
      errors.push("This relationship already exists");
    }
    
    // Circular relation detection
    const isCircular = await this.detectCircularRelation(eventId, person1Id, person2Id, relationType, familySide);
    if (isCircular) {
      errors.push("This would create a circular relationship");
    }
    
    // Age validation
    const person1 = await User.findById(person1Id);
    const person2 = await User.findById(person2Id);
    
    if (relationType === "parent" && person2?.dob && person1?.dob) {
      if (person2.dob <= person1.dob) {
        errors.push("Parent must be older than child");
      }
      const ageDiff = Math.abs(person2.dob.getFullYear() - person1.dob.getFullYear());
      if (ageDiff < 12) {
        errors.push("Age difference between parent and child must be at least 12 years");
      }
    }
    
    return { isValid: errors.length === 0, errors };
  }
  
  // Detect circular relationships
  static async detectCircularRelation(eventId, person1Id, person2Id, relationType, familySide) {
    if (relationType === "parent") {
      const ancestors = await this.getAncestors(eventId, person2Id, familySide);
      if (ancestors.some(a => a.toString() === person1Id.toString())) {
        return true;
      }
    }
    
    if (relationType === "child") {
      const ancestors = await this.getAncestors(eventId, person1Id, familySide);
      if (ancestors.some(a => a.toString() === person2Id.toString())) {
        return true;
      }
    }
    
    return false;
  }
  
  // Get all ancestors of a person
  static async getAncestors(eventId, userId, familySide = "common") {
    const ancestors = new Set();
    const queue = [userId];
    
    while (queue.length > 0) {
      const current = queue.shift();
      const parents = await Relationship.find({
        eventId,
        familySide,
        person2: current,
        relationType: "parent"
      }).populate("person1");
      
      for (const parent of parents) {
        if (!ancestors.has(parent.person1._id.toString())) {
          ancestors.add(parent.person1._id.toString());
          queue.push(parent.person1._id);
        }
      }
    }
    
    return Array.from(ancestors);
  }
  
  // Infer implied parent edges across sibling groups (display-time only, never persisted).
  // Rule: if X is parent/grandparent of A, and A is sibling of B (direct or transitive),
  //       then X is also parent/grandparent of B.
  static inferFamilyEdges(edges) {
    const siblingOf   = new Map(); // nodeId → Set<nodeId>
    const childParents = new Map(); // childId → [{ parentId, relation }]

    for (const e of edges) {
      const r = e.relation;
      if (r === 'sibling' || r === 'step-sibling') {
        if (!siblingOf.has(e.from)) siblingOf.set(e.from, new Set());
        if (!siblingOf.has(e.to))   siblingOf.set(e.to,   new Set());
        siblingOf.get(e.from).add(e.to);
        siblingOf.get(e.to).add(e.from);
      }
      // from is the ancestor
      if (r === 'parent' || r === 'step-parent' || r === 'grandparent') {
        if (!childParents.has(e.to)) childParents.set(e.to, []);
        childParents.get(e.to).push({ parentId: e.from, relation: r });
      }
      // from is the child, to is the parent
      if (r === 'child') {
        if (!childParents.has(e.from)) childParents.set(e.from, []);
        childParents.get(e.from).push({ parentId: e.to, relation: 'parent' });
      }
    }

    // BFS transitive sibling closure so A-B-C chains all share the same parent group
    const getSiblingGroup = (startId) => {
      const group = new Set([startId]);
      const queue = [startId];
      while (queue.length) {
        const curr = queue.shift();
        for (const sib of (siblingOf.get(curr) || [])) {
          if (!group.has(sib)) { group.add(sib); queue.push(sib); }
        }
      }
      return group;
    };

    const existing = new Set(edges.map(e => `${e.from}|${e.to}|${e.relation}`));
    const inferred = [];

    for (const [childId, parents] of childParents) {
      const sibGroup = getSiblingGroup(childId);
      for (const sibId of sibGroup) {
        if (sibId === childId) continue;
        for (const { parentId, relation } of parents) {
          const key = `${parentId}|${sibId}|${relation}`;
          if (!existing.has(key)) {
            inferred.push({ from: parentId, to: sibId, relation });
            existing.add(key);
          }
        }
      }
    }

    return inferred;
  }

  // BFS to assign generation numbers relative to anchor node (anchor = G0)
  static computeGenerations(edges, anchorId) {
    const genMap = new Map();
    if (!anchorId) return genMap;

    const anchorStr = anchorId.toString();
    genMap.set(anchorStr, 0);

    // Build bidirectional adjacency list
    const adj = new Map();
    for (const edge of edges) {
      const f = edge.from?.toString();
      const t = edge.to?.toString();
      if (!f || !t) continue;
      if (!adj.has(f)) adj.set(f, []);
      if (!adj.has(t)) adj.set(t, []);
      adj.get(f).push({ neighbor: t, relation: edge.relation, direction: 'forward' });
      adj.get(t).push({ neighbor: f, relation: edge.relation, direction: 'reverse' });
    }

    const queue = [anchorStr];
    while (queue.length > 0) {
      const id = queue.shift();
      const currentGen = genMap.get(id);
      for (const { neighbor, relation, direction } of (adj.get(id) || [])) {
        if (genMap.has(neighbor)) continue;
        const delta = (GEN_DELTA[relation] || { forward: 0, reverse: 0 })[direction];
        genMap.set(neighbor, currentGen + delta);
        queue.push(neighbor);
      }
    }

    return genMap;
  }

  // Generate tree visualization data
  // Pass saveHistory=true only from mutation paths (add/remove/update) — never on reads
  static async generateTree(eventId, familySide = "common", saveHistory = false) {
    const event = await Event.findById(eventId);
    if (!event) throw new Error("Event not found");

    // Resolve the anchor person (G0) for this side
    let anchorId = null;
    if (familySide === 'groom') anchorId = event.treeConfig?.groomId?.toString();
    else if (familySide === 'bride') anchorId = event.treeConfig?.brideId?.toString();
    else anchorId = event.treeConfig?.mainPersonId?.toString();

    let query = { eventId, isValidated: true };
    if (familySide !== "common") {
      // Strict per-side filtering: only show relationships belonging to this side.
      // "common" relationships (groom-bride link) are excluded so each tree stays clean.
      query.familySide = familySide;
    }

    const relationships = await Relationship.find(query)
      .populate("person1 person2");

    const nodes = new Map();
    const edges = [];

    // Build nodes from unique users
    for (const rel of relationships) {
      if (rel.person1 && !nodes.has(rel.person1._id.toString())) {
        nodes.set(rel.person1._id.toString(), {
          id: rel.person1._id,
          name: rel.person1.username,
          email: rel.person1.email,
          dob: rel.person1.dob,
          gender: rel.person1.gender,
          profileImage: rel.person1.profileImage,
        });
      }
      if (rel.person2 && !nodes.has(rel.person2._id.toString())) {
        nodes.set(rel.person2._id.toString(), {
          id: rel.person2._id,
          name: rel.person2.username,
          email: rel.person2.email,
          dob: rel.person2.dob,
          gender: rel.person2.gender,
          profileImage: rel.person2.profileImage,
        });
      }

      edges.push({
        from: rel.person1?._id?.toString(),
        to: rel.person2?._id?.toString(),
        relation: rel.relationType,
      });
    }

    // Infer implied parent/grandparent edges across sibling groups.
    // Rule: if X is parent of A, and A is sibling of B, then X is also parent of B.
    // This runs on stored edges only (never writes to DB — display-time inference).
    edges.push(...this.inferFamilyEdges(edges));

    // Always include the anchor node at G0 even if it has no relationships yet
    if (anchorId && !nodes.has(anchorId)) {
      const anchorUser = await User.findById(anchorId);
      if (anchorUser) {
        nodes.set(anchorId, {
          id: anchorUser._id,
          name: anchorUser.username,
          email: anchorUser.email,
          dob: anchorUser.dob,
          gender: anchorUser.gender,
          profileImage: anchorUser.profileImage,
        });
      }
    }

    // Compute generation numbers (BFS from anchor)
    const genMap = this.computeGenerations(edges, anchorId);
    for (const [id, node] of nodes) {
      node.generation = genMap.has(id) ? genMap.get(id) : 0;
    }

    // Generate Mermaid code
    const mermaidCode = this.generateMermaidCode(nodes, edges);

    // Save snapshot only on mutation paths — never on reads
    let version = 1;
    if (saveHistory) {
      try {
        version = await this.getNextVersion(eventId, familySide);
        const history = new TreeHistory({
          eventId,
          familySide,
          rootUsers: await this.findRootUsers(eventId, relationships, familySide),
          nodes: Array.from(nodes.values()),
          edges,
          generatedMermaidCode: mermaidCode,
          version,
        });
        await history.save();
      } catch (histErr) {
        console.warn('[TreeEngine] history save skipped:', histErr.message);
      }
    }

    return {
      treeType: event.treeType,
      familySide,
      nodes: Array.from(nodes.values()),
      edges,
      mermaidCode,
      version,
    };
  }
  
  // Ensure placeholder user exists for an anchor role; repairs events created before the fix
  static async ensurePlaceholder(event, role, name) {
    if (!name) return null;
    const tag = role; // 'groom', 'bride', or 'main'
    const plEmail = `${tag}_${event.eventCode.toLowerCase()}@placeholder.fam`;
    let u = await User.findOne({ email: plEmail });
    if (!u) {
      u = new User({ username: name, email: plEmail, dob: new Date('1990-01-01'), isTemporary: true });
      await u.save();
    }
    // Ensure participant membership
    if (!event.participants.some(p => p.toString() === u._id.toString())) {
      event.participants.push(u._id);
    }
    return u;
  }

  // Generate full tree structure based on event type
  static async generateFullTree(eventId, saveHistory = false) {
    const event = await Event.findById(eventId);
    if (!event) throw new Error("Event not found");

    const isWedding = event.treeType === "wedding" || event.treeType === "anniversary";

    // ── Lazy repair: create missing placeholder users for events created before the fix ──
    let treeConfigChanged = false;
    if (!event.treeConfig) event.treeConfig = {};

    if (isWedding) {
      if (!event.treeConfig.groomId && event.groomName) {
        const u = await this.ensurePlaceholder(event, 'groom', event.groomName);
        if (u) { event.treeConfig.groomId = u._id; treeConfigChanged = true; }
      }
      if (!event.treeConfig.brideId && event.brideName) {
        const u = await this.ensurePlaceholder(event, 'bride', event.brideName);
        if (u) { event.treeConfig.brideId = u._id; treeConfigChanged = true; }
      }
      // Create the spouse relationship if missing
      if (treeConfigChanged && event.treeConfig.groomId && event.treeConfig.brideId) {
        try {
          const exists = await Relationship.findOne({ eventId: event._id, person1: event.treeConfig.groomId, person2: event.treeConfig.brideId });
          if (!exists) {
            await Relationship.create({
              eventId: event._id, addedBy: event.createdBy,
              person1: event.treeConfig.groomId, person2: event.treeConfig.brideId,
              relationType: 'spouse', familySide: 'common', isValidated: true, createdBy: event.createdBy,
            });
          }
        } catch (_) { /* non-fatal */ }
      }
    } else {
      if (!event.treeConfig.mainPersonId && event.mainPersonName) {
        const u = await this.ensurePlaceholder(event, 'main', event.mainPersonName);
        if (u) { event.treeConfig.mainPersonId = u._id; treeConfigChanged = true; }
      }
    }

    if (treeConfigChanged) {
      event.markModified('treeConfig');
      await event.save();
    }
    // ── End lazy repair ──

    if (isWedding) {
      const [groomTree, brideTree] = await Promise.all([
        this.generateTree(eventId, "groom", saveHistory),
        this.generateTree(eventId, "bride", saveHistory),
      ]);
      return {
        treeType: event.treeType,
        groom: {
          mainPerson: await User.findById(event.treeConfig?.groomId).lean(),
          tree: groomTree,
        },
        bride: {
          mainPerson: await User.findById(event.treeConfig?.brideId).lean(),
          tree: brideTree,
        },
      };
    } else {
      const commonTree = await this.generateTree(eventId, "common", saveHistory);
      return {
        treeType: "common",
        mainPerson: await User.findById(event.treeConfig?.mainPersonId).lean(),
        tree: commonTree,
      };
    }
  }
  
  // Find root users (people with no parents)
  static async findRootUsers(eventId, relationships, familySide) {
    const children = new Set(relationships.map(r => r.person2?._id?.toString()).filter(Boolean));
    const allUsers = new Set();
    
    relationships.forEach(r => {
      if (r.person1) allUsers.add(r.person1._id.toString());
      if (r.person2) allUsers.add(r.person2._id.toString());
    });
    
    const rootUsers = Array.from(allUsers).filter(u => !children.has(u));
    return rootUsers;
  }
  
  // Generate FAMScript-style Mermaid code with generation subgraphs and gender colours
  static generateMermaidCode(nodes, edges) {
    if (nodes.size === 0) return 'graph TB\n  empty["No persons defined yet"]';

    // Map original MongoDB id → short Mermaid-safe id
    const nodeIdMap = new Map();
    let counter = 1;
    for (const [id] of nodes) {
      nodeIdMap.set(id, `N${counter++}`);
    }

    // Group nodes by generation number
    const groups = new Map();
    for (const [id, node] of nodes) {
      const g = node.generation ?? 0;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push({ ...node, _mapId: id });
    }

    // Ancestors on top — sort descending
    const sortedGens = [...groups.keys()].sort((a, b) => b - a);

    let out = 'graph TB\n';

    for (const g of sortedGens) {
      const sgId = g === 0 ? 'GEN_0' : g < 0 ? `GEN_N${Math.abs(g)}` : `GEN_P${g}`;
      const sgLabel = GEN_LABELS[g] ?? `GEN ${g >= 0 ? '+' : ''}${g}`;
      out += `\n  subgraph ${sgId}["${sgLabel}"]\n`;
      for (const node of groups.get(g)) {
        const nid = nodeIdMap.get(node._mapId);
        const safeName = (node.name || `Person_${nid}`)
          .replace(/"/g, "'")
          .replace(/[<>\[\]{}|\\]/g, '');
        out += `    ${nid}["${safeName}"]\n`;
      }
      out += '  end\n';
    }

    out += '\n';

    // Edges with directional style matching the relation type
    for (const edge of edges) {
      const fid = nodeIdMap.get(edge.from);
      const tid = nodeIdMap.get(edge.to);
      if (!fid || !tid) continue;
      const edgeStyle = EDGE_MAP[edge.relation] || '---';
      const label = (edge.relation || '').replace(/"/g, "'");
      out += `  ${fid} ${edgeStyle}|"${label}"| ${tid}\n`;
    }

    // Gender-based node colours — normalise "male"/"female" stored in DB
    const normG = (g) => {
      if (!g) return '';
      const s = String(g).toLowerCase();
      if (s === 'm' || s === 'male')   return 'M';
      if (s === 'f' || s === 'female') return 'F';
      return '';
    };
    out += '\n';
    for (const [id, node] of nodes) {
      const nid = nodeIdMap.get(id);
      const g   = normG(node.gender);
      if (g === 'M') {
        out += `  style ${nid} fill:#3b82f6,color:#fff,stroke:#1d4ed8,stroke-width:2px\n`;
      } else if (g === 'F') {
        out += `  style ${nid} fill:#ec4899,color:#fff,stroke:#9d174d,stroke-width:2px\n`;
      } else {
        out += `  style ${nid} fill:#6b7280,color:#fff,stroke:#374151,stroke-width:2px\n`;
      }
    }

    return out;
  }
  
  static async getNextVersion(eventId, familySide = "common") {
    const lastHistory = await TreeHistory.findOne({ eventId, familySide }).sort({ version: -1 });
    return lastHistory ? lastHistory.version + 1 : 1;
  }
  
  // Get tree history
  static async getTreeHistory(eventId, familySide = "common", version = null) {
    const query = { eventId, familySide };
    if (version) query.version = version;
    
    if (version) {
      return await TreeHistory.findOne(query);
    }
    return await TreeHistory.find(query).sort({ version: -1 });
  }
  
  // Remove relationship (Organizer/Admin only)
  static async removeRelationship(relationshipId, userId, role, eventId) {
    const relationship = await Relationship.findById(relationshipId);
    if (!relationship) {
      throw new Error("Relationship not found");
    }
    
    // Check permissions - ONLY organizer or admin can remove
    if (role !== "admin" && role !== "organizer") {
      throw new Error("Not authorized. Only organizer or admin can remove relationships");
    }
    
    // If organizer, verify they are assigned to this event (single or multi-event)
    if (role === "organizer") {
      const targetEventId = (eventId || relationship.eventId).toString();
      const organizer = await Organizer.findOne({ _id: userId, isActive: true });
      const isAssigned = organizer && (
        organizer.assignedEvent?.toString() === targetEventId ||
        organizer.assignedEvents?.some(e => e.toString() === targetEventId)
      );
      if (!isAssigned) {
        throw new Error("Not authorized to remove relationships from this event");
      }
    }
    
    await relationship.deleteOne();

    // Decrement addedPeopleCount for the user who added this relationship (no-op for org/admin)
    const addedByUser = await User.findById(relationship.addedBy);
    if (addedByUser && addedByUser.addedPeopleCount > 0) {
      addedByUser.addedPeopleCount -= 1;
      await addedByUser.save();
    }

    return { success: true, eventId: relationship.eventId };
  }

  // Returns the inverse of a relationType for bidirectional path display
  static inverseRelation(relationType) {
    const inverses = {
      "parent": "child",
      "child": "parent",
      "spouse": "spouse",
      "sibling": "sibling",
      "friend": "friend",
      "step-parent": "step-child",
      "step-child": "step-parent",
      "step-sibling": "step-sibling",
      "grandparent": "grandchild",
      "grandchild": "grandparent",
      "cousin": "cousin",
      "uncle": "nephew",
      "aunt": "niece",
      "nephew": "uncle",
      "niece": "aunt",
      "father-in-law": "child-in-law",
      "mother-in-law": "child-in-law",
      "brother-in-law": "brother-in-law",
      "sister-in-law": "sister-in-law",
    };
    return inverses[relationType] || relationType;
  }

  // BFS path discovery: how are fromUserId and toUserId related?
  static async findPath(eventId, fromUserId, toUserId) {
    const fromStr = fromUserId.toString();
    const toStr = toUserId.toString();

    if (fromStr === toStr) return { found: true, path: [], length: 0 };

    // Single bulk query — no N+1
    const relationships = await Relationship.find({ eventId, isValidated: true });

    const adj = {};
    for (const rel of relationships) {
      const p1 = rel.person1.toString();
      const p2 = rel.person2.toString();
      if (!adj[p1]) adj[p1] = [];
      if (!adj[p2]) adj[p2] = [];
      adj[p1].push({ userId: p2, relation: rel.relationType });
      adj[p2].push({ userId: p1, relation: this.inverseRelation(rel.relationType) });
    }

    const visited = new Set([fromStr]);
    const queue = [{ userId: fromStr, path: [] }];

    while (queue.length > 0) {
      const { userId, path } = queue.shift();
      for (const { userId: nextId, relation } of (adj[userId] || [])) {
        const newPath = [...path, { userId: nextId, relation }];
        if (nextId === toStr) {
          return { found: true, path: newPath, length: newPath.length };
        }
        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push({ userId: nextId, path: newPath });
        }
      }
    }

    return { found: false, path: [], length: 0 };
  }
}

export default TreeEngine;