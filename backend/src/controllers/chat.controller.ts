import { Request, Response } from 'express';
import { db } from '../firebase';

export const getChatHistory = async (req: Request, res: Response) => {
  try {
    const { userA, userB } = req.params;
    const history = await db.getChats(userA, userB);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sendChatMessage = async (req: Request, res: Response) => {
  try {
    const { from, to, text, image } = req.body;
    if (!from || !to || (!text && !image)) {
      return res.status(400).json({ error: 'sender, receiver and text/image content are required' });
    }
    const message = await db.addChatMessage({ from, to, text: text || '', image: image || '' });
    res.status(201).json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
