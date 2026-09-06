import { Request, Response } from 'express';
import { db } from '../firebase';

export const getPlansController = async (req: Request, res: Response) => {
  try {
    const plans = await db.getPlans();
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createPlanController = async (req: Request, res: Response) => {
  try {
    const planData = req.body;
    if (!planData.name || !planData.price || !planData.durationDays) {
      return res.status(400).json({ error: 'Name, price, and durationDays are required fields' });
    }
    const plan = await db.addPlan(planData);
    res.status(201).json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updatePlanController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const plan = await db.updatePlan(id, updates);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deletePlanController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await db.deletePlan(id);
    if (!success) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
