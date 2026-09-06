import { Request, Response } from 'express';
import { db } from '../firebase';

export const getProgressTimeline = async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const logs = await db.getProgressLogsByMember(memberId);
    res.json(logs);
  } catch (error: any) {
    console.error('Error in getProgressTimeline:', error);
    res.status(500).json({ error: error.message });
  }
};

export const addProgressRecord = async (req: Request, res: Response) => {
  try {
    const { memberId, weight, height, bodyFat, waist, chest, arms, shoulders } = req.body;
    if (!memberId || !weight) {
      return res.status(400).json({ error: 'memberId and weight are required' });
    }

    const wt = Number(weight);
    const ht = Number(height) || 170; // fallback height in cm
    const heightInMeters = ht / 100;
    const bmi = Number((wt / (heightInMeters * heightInMeters)).toFixed(1));

    const log = await db.addProgressLog({
      memberId,
      weight: wt,
      bmi,
      bodyFat: Number(bodyFat) || 15,
      waist: Number(waist) || 32,
      chest: Number(chest) || 40,
      arms: Number(arms) || 14,
      shoulders: Number(shoulders) || 45
    });

    res.status(201).json(log);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getReferralsByMember = async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const list = await db.getReferrals(memberId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createReferralInvitation = async (req: Request, res: Response) => {
  try {
    const { memberId, friendName, friendEmail } = req.body;
    if (!memberId || !friendName || !friendEmail) {
      return res.status(400).json({ error: 'memberId, friendName and friendEmail are required' });
    }
    const invitation = await db.addReferral({ memberId, friendName, friendEmail });
    res.status(201).json(invitation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
