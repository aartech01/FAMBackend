// controllers/worldTreeController.js
import WorldTree from "../models/WorldTree.js";
import User from "../models/User.js";

// Activate World Tree (after payment)
export const activateWorldTree = async (req, res) => {
  try {
    const { paymentId, amount } = req.body;
    const userId = req.user.id;
    
    // Check if already activated
    const existing = await WorldTree.findOne({ userId });
    if (existing && existing.isActive) {
      return res.status(400).json({
        success: false,
        message: "World Tree already activated",
      });
    }
    
    const worldTree = new WorldTree({
      userId,
      paymentStatus: "completed",
      paymentId,
      paymentDate: new Date(),
      amount: amount || 499,
      isActive: true,
    });
    
    await worldTree.save();
    
    res.status(200).json({
      success: true,
      message: "World Tree activated successfully",
      worldTree,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get World Tree data
export const getWorldTree = async (req, res) => {
  try {
    const worldTree = await WorldTree.findOne({ 
      userId: req.user.id,
      isActive: true 
    });
    
    if (!worldTree) {
      return res.status(403).json({
        success: false,
        message: "World Tree not activated. Pay ₹499 to activate.",
      });
    }
    
    res.status(200).json({
      success: true,
      worldTree,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Add to global world tree
export const addToWorldTree = async (req, res) => {
  try {
    const { nodes, edges } = req.body;
    
    const worldTree = await WorldTree.findOne({ 
      userId: req.user.id,
      isActive: true 
    });
    
    if (!worldTree) {
      return res.status(403).json({
        success: false,
        message: "World Tree not activated",
      });
    }
    
    worldTree.treeData = { nodes, edges };
    worldTree.markModified("treeData");
    await worldTree.save();
    
    res.status(200).json({
      success: true,
      message: "Added to World Tree successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};