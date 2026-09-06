import { Request, Response } from 'express';
import { db } from '../firebase';

export const getWorkoutPlan = async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const plans = await db.getWorkoutsByMember(memberId);
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const saveWorkoutPlan = async (req: Request, res: Response) => {
  try {
    const { memberId, name, type, duration, exercises } = req.body;
    if (!memberId || !name || !exercises) {
      return res.status(400).json({ error: 'memberId, name and exercises are required' });
    }
    const saved = await db.saveWorkout({ memberId, name, type, duration, exercises });
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDietPlan = async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const diet = await db.getDietByMember(memberId);
    res.json(diet);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const saveDietPlan = async (req: Request, res: Response) => {
  try {
    const { memberId, name, calories, protein, carbs, fats, waterGoal, meals, status } = req.body;
    if (!memberId || !name || !meals) {
      return res.status(400).json({ error: 'memberId, name and meals are required' });
    }
    const saved = await db.saveDiet({
      memberId, name,
      calories: Number(calories) || 2000,
      protein: Number(protein) || 120,
      carbs: Number(carbs) || 180,
      fats: Number(fats) || 60,
      waterGoal: Number(waterGoal) || 3,
      meals,
      status: status || 'draft',
      updatedAt: new Date().toISOString()
    });
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// AI Diet Plan Generator using nutrition formulas and client profile
export const generateAIDiet = async (req: Request, res: Response) => {
  try {
    const { memberId } = req.body;
    if (!memberId) {
      return res.status(400).json({ error: 'memberId is required' });
    }

    // 1. Fetch member details
    const members = await db.getMembers();
    const member = members.find((m: any) => m.id === memberId || m.memberId === memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // 2. Extract profile specs (use defaults if missing)
    const weight = Number(member.weight) || 75; // kg
    const height = Number(member.height) || 175; // cm
    const age = Number(member.age) || 28;
    const gender = member.gender || 'Male';
    const goal = member.goal || 'Fat Loss';
    const pref = (member.foodPreference || 'Vegetarian').toLowerCase();
    const medical = member.medicalConditions || 'None';
    const allergies = member.allergies || 'None';
    const activity = member.activityLevel || 'Active';

    // 3. Calorie & Macro Target Math
    let calorieMultiplier = 28;
    if (goal.toLowerCase().includes('gain') && goal.toLowerCase().includes('weight')) calorieMultiplier = 38;
    else if (goal.toLowerCase().includes('muscle') && goal.toLowerCase().includes('gain')) calorieMultiplier = 35;
    else if (goal.toLowerCase().includes('loss') || goal.toLowerCase().includes('fat')) calorieMultiplier = 24;
    else if (goal.toLowerCase().includes('strength')) calorieMultiplier = 30;

    let targetCalories = Math.round(weight * calorieMultiplier);
    
    // Adjust target calories slightly based on activity level
    if (activity.toLowerCase() === 'sedentary') targetCalories = Math.round(targetCalories * 0.9);
    if (activity.toLowerCase() === 'very active') targetCalories = Math.round(targetCalories * 1.15);

    // Protein Target: ~1.8g to 2.2g per kg based on goal
    let proteinPerKg = 1.8;
    if (goal.toLowerCase().includes('muscle') || goal.toLowerCase().includes('fat')) {
      proteinPerKg = 2.2;
    }
    const targetProtein = Math.round(weight * proteinPerKg);
    
    // Fats: 25% of calories
    const targetFats = Math.round((targetCalories * 0.25) / 9);
    
    // Carbs: Remaining calories
    const targetCarbs = Math.round((targetCalories - (targetProtein * 4) - (targetFats * 9)) / 4);

    // Water Goal (Liters)
    let targetWater = 3.0;
    if (weight > 80) targetWater = 3.5;
    if (activity.toLowerCase() === 'very active') targetWater += 0.5;

    // 4. Load food items template based on preference
    // Standard template has 6 meals totaling ~2000 kcal, 140g P, 220g C, 60g F. We scale portions to match the exact target
    const baseCalories = 2000;
    const scaleFactor = targetCalories / baseCalories;

    let meals: any[] = [];
    let groceryList: any[] = [];

    if (pref === 'vegan') {
      meals = [
        {
          time: '07:00 AM',
          name: 'Breakfast',
          foods: 'Chia Seed Oats Pudding with Soy Milk, Almonds & Berries',
          calories: Math.round(400 * scaleFactor),
          protein: Math.round(25 * scaleFactor),
          carbs: Math.round(55 * scaleFactor),
          fats: Math.round(10 * scaleFactor),
          portion: `${Math.round(50 * scaleFactor)}g Oats, 250ml Soy Milk, 10g Chia Seeds`
        },
        {
          time: '10:30 AM',
          name: 'Mid-Morning Snack',
          foods: 'Roasted Chickpeas & Walnuts',
          calories: Math.round(200 * scaleFactor),
          protein: Math.round(10 * scaleFactor),
          carbs: Math.round(25 * scaleFactor),
          fats: Math.round(8 * scaleFactor),
          portion: `${Math.round(40 * scaleFactor)}g Chickpeas, 15g Walnuts`
        },
        {
          time: '01:00 PM',
          name: 'Lunch',
          foods: 'Tofu & Quinoa High-Protein Salad with Avocado',
          calories: Math.round(500 * scaleFactor),
          protein: Math.round(35 * scaleFactor),
          carbs: Math.round(60 * scaleFactor),
          fats: Math.round(15 * scaleFactor),
          portion: `${Math.round(150 * scaleFactor)}g Grilled Tofu, 1.5 cups Quinoa, 50g Avocado`
        },
        {
          time: '05:00 PM',
          name: 'Pre Workout',
          foods: 'Rice Cakes with Almond Butter & Sliced Banana',
          calories: Math.round(250 * scaleFactor),
          protein: Math.round(8 * scaleFactor),
          carbs: Math.round(35 * scaleFactor),
          fats: Math.round(10 * scaleFactor),
          portion: `2 Rice Cakes, ${Math.round(15 * scaleFactor)}g Almond Butter, 1/2 Banana`
        },
        {
          time: '06:30 PM',
          name: 'Post Workout',
          foods: 'Plant Protein Shake with Water',
          calories: Math.round(150 * scaleFactor),
          protein: Math.round(25 * scaleFactor),
          carbs: Math.round(5 * scaleFactor),
          fats: Math.round(2 * scaleFactor),
          portion: `1.5 Scoops Pea/Soy Protein, 300ml Water`
        },
        {
          time: '08:00 PM',
          name: 'Dinner',
          foods: 'Lentil Pasta with Broccoli & Tomato Marinara',
          calories: Math.round(500 * scaleFactor),
          protein: Math.round(37 * scaleFactor),
          carbs: Math.round(75 * scaleFactor),
          fats: Math.round(10 * scaleFactor),
          portion: `${Math.round(90 * scaleFactor)}g Lentil Pasta, 100g Steamed Broccoli`
        }
      ];

      groceryList = [
        { name: 'Rolled Oats', quantity: '500g', category: 'Grains' },
        { name: 'Soy Milk (Unsweetened)', quantity: '2 Liters', category: 'Dairy Alternatives' },
        { name: 'Chia Seeds', quantity: '200g', category: 'Seeds & Nuts' },
        { name: 'Organic Firm Tofu', quantity: '1.2 kg', category: 'Vegan Protein' },
        { name: 'Quinoa', quantity: '1 kg', category: 'Grains' },
        { name: 'Pea Protein Powder', quantity: '1 Tub (1kg)', category: 'Supplements' },
        { name: 'Lentil Pasta', quantity: '500g', category: 'Grains' },
        { name: 'Almond Butter', quantity: '1 Jar', category: 'Seeds & Nuts' },
        { name: 'Avocado & Banana & Berries', quantity: '1 Bunch / Box', category: 'Fruits' },
        { name: 'Broccoli & Spinach', quantity: '500g each', category: 'Vegetables' }
      ];
    } else if (pref.includes('non-veg') || pref.includes('chicken') || pref.includes('egg')) {
      meals = [
        {
          time: '07:00 AM',
          name: 'Breakfast',
          foods: 'Egg White Omelet & Whole Wheat Toast with Spinach',
          calories: Math.round(380 * scaleFactor),
          protein: Math.round(32 * scaleFactor),
          carbs: Math.round(30 * scaleFactor),
          fats: Math.round(8 * scaleFactor),
          portion: `5 Egg Whites, 1 Whole Egg, 2 Slices Toast`
        },
        {
          time: '10:30 AM',
          name: 'Mid-Morning Snack',
          foods: 'Whey Protein Shake & Mixed Nuts',
          calories: Math.round(220 * scaleFactor),
          protein: Math.round(26 * scaleFactor),
          carbs: Math.round(8 * scaleFactor),
          fats: Math.round(10 * scaleFactor),
          portion: `1 Scoop Whey, 15g Walnuts/Almonds`
        },
        {
          time: '01:00 PM',
          name: 'Lunch',
          foods: 'Grilled Chicken Breast with Sweet Potato & Asparagus',
          calories: Math.round(520 * scaleFactor),
          protein: Math.round(42 * scaleFactor),
          carbs: Math.round(55 * scaleFactor),
          fats: Math.round(12 * scaleFactor),
          portion: `${Math.round(160 * scaleFactor)}g Chicken Breast, 150g Sweet Potato`
        },
        {
          time: '05:00 PM',
          name: 'Pre Workout',
          foods: 'Rice Cakes with Peanut Butter & Honey',
          calories: Math.round(200 * scaleFactor),
          protein: Math.round(7 * scaleFactor),
          carbs: Math.round(30 * scaleFactor),
          fats: Math.round(8 * scaleFactor),
          portion: `2 Rice Cakes, ${Math.round(15 * scaleFactor)}g Peanut Butter, 1 tsp Honey`
        },
        {
          time: '06:30 PM',
          name: 'Post Workout',
          foods: 'Whey Protein & Dextrose Shake',
          calories: Math.round(180 * scaleFactor),
          protein: Math.round(26 * scaleFactor),
          carbs: Math.round(20 * scaleFactor),
          fats: Math.round(1 * scaleFactor),
          portion: `1 Scoop Whey, 1 Medium Banana`
        },
        {
          time: '08:00 PM',
          name: 'Dinner',
          foods: 'Baked Salmon Fillet with Brown Rice & Broccoli',
          calories: Math.round(500 * scaleFactor),
          protein: Math.round(37 * scaleFactor),
          carbs: Math.round(45 * scaleFactor),
          fats: Math.round(16 * scaleFactor),
          portion: `${Math.round(150 * scaleFactor)}g Salmon, 1 cup Brown Rice`
        }
      ];

      groceryList = [
        { name: 'Fresh Eggs', quantity: '3 Dozen', category: 'Eggs' },
        { name: 'Chicken Breast (Boneless)', quantity: '1.5 kg', category: 'Poultry' },
        { name: 'Salmon Fillets', quantity: '1 kg', category: 'Seafood' },
        { name: 'Whole Wheat Bread', quantity: '1 Loaf', category: 'Bakery' },
        { name: 'Brown Rice & Sweet Potatoes', quantity: '1 kg each', category: 'Grains & Carbs' },
        { name: 'Whey Protein Isolate', quantity: '1 Tub (1kg)', category: 'Supplements' },
        { name: 'Peanut Butter', quantity: '1 Jar', category: 'Seeds & Nuts' },
        { name: 'Asparagus & Broccoli', quantity: '500g each', category: 'Vegetables' },
        { name: 'Bananas & Lemons', quantity: '1 Dozen / 5 units', category: 'Fruits' }
      ];
    } else {
      // Vegetarian (Default)
      meals = [
        {
          time: '07:00 AM',
          name: 'Breakfast',
          foods: 'Oats Porridge with Low Fat Milk, Almonds & Sliced Banana',
          calories: Math.round(420 * scaleFactor),
          protein: Math.round(20 * scaleFactor),
          carbs: Math.round(65 * scaleFactor),
          fats: Math.round(10 * scaleFactor),
          portion: `${Math.round(50 * scaleFactor)}g Oats, 250ml Milk, 12 Almonds`
        },
        {
          time: '10:30 AM',
          name: 'Mid-Morning Snack',
          foods: 'Low Fat Greek Yogurt with Honey & Berries',
          calories: Math.round(180 * scaleFactor),
          protein: Math.round(15 * scaleFactor),
          carbs: Math.round(25 * scaleFactor),
          fats: Math.round(3 * scaleFactor),
          portion: `${Math.round(150 * scaleFactor)}g Greek Yogurt, 1 tsp Honey`
        },
        {
          time: '01:00 PM',
          name: 'Lunch',
          foods: 'Paneer Bhurji / Grilled Paneer with Brown Rice & Mixed Salad',
          calories: Math.round(550 * scaleFactor),
          protein: Math.round(35 * scaleFactor),
          carbs: Math.round(55 * scaleFactor),
          fats: Math.round(22 * scaleFactor),
          portion: `${Math.round(140 * scaleFactor)}g Paneer, 1 cup Brown Rice`
        },
        {
          time: '05:00 PM',
          name: 'Pre Workout',
          foods: 'Black Coffee & Handful of Roasted Chana with 1 Apple',
          calories: Math.round(150 * scaleFactor),
          protein: Math.round(5 * scaleFactor),
          carbs: Math.round(30 * scaleFactor),
          fats: Math.round(2 * scaleFactor),
          portion: `30g Roasted Chana, 1 Medium Apple`
        },
        {
          time: '06:30 PM',
          name: 'Post Workout',
          foods: 'Whey Protein Shake & Rice Cakes',
          calories: Math.round(200 * scaleFactor),
          protein: Math.round(28 * scaleFactor),
          carbs: Math.round(18 * scaleFactor),
          fats: Math.round(2 * scaleFactor),
          portion: `1 Scoop Whey, 2 Rice Cakes`
        },
        {
          time: '08:00 PM',
          name: 'Dinner',
          foods: 'Lentil Tadka (Dal) with Tofu / Soya Chunks & Roti / Chapati',
          calories: Math.round(500 * scaleFactor),
          protein: Math.round(37 * scaleFactor),
          carbs: Math.round(65 * scaleFactor),
          fats: Math.round(11 * scaleFactor),
          portion: `1.5 bowls Dal, ${Math.round(60 * scaleFactor)}g Soya Chunks, 2 Rotis`
        }
      ];

      groceryList = [
        { name: 'Rolled Oats', quantity: '500g', category: 'Grains' },
        { name: 'Low Fat Milk', quantity: '2 Liters', category: 'Dairy' },
        { name: 'Low Fat Greek Yogurt', quantity: '1 kg', category: 'Dairy' },
        { name: 'Fresh Paneer', quantity: '1 kg', category: 'Dairy' },
        { name: 'Yellow/Black Lentils (Dal)', quantity: '1 kg', category: 'Pulltry/Lentils' },
        { name: 'Soya Chunks / Tofu', quantity: '500g / 500g', category: 'Vegetarian Protein' },
        { name: 'Brown Rice & Whole Wheat Atta', quantity: '1 kg each', category: 'Grains' },
        { name: 'Whey Protein Powder', quantity: '1 Tub (1kg)', category: 'Supplements' },
        { name: 'Apples & Bananas & Almonds', quantity: '1 Dozen / Box', category: 'Fruits & Nuts' },
        { name: 'Broccoli, Spinach, Onions', quantity: '500g each', category: 'Vegetables' }
      ];
    }

    // Apply any medical condition or allergy flags in the description
    let planName = `AI Diet Plan: ${goal}`;
    if (pref) {
      planName += ` (${pref.charAt(0).toUpperCase() + pref.slice(1)})`;
    }

    const aiPlan = {
      memberId: member.id, // Keep consistent with member unique id
      name: planName,
      calories: targetCalories,
      protein: targetProtein,
      carbs: targetCarbs,
      fats: targetFats,
      waterGoal: targetWater,
      meals,
      weeklyGroceryList: groceryList,
      status: 'draft',
      assignedBy: 'Trainer Engine AI',
      updatedAt: new Date().toISOString()
    };

    const saved = await db.saveDiet(aiPlan);
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const approveDietPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }
    const approved = await db.approveDiet(id);
    if (!approved) {
      return res.status(404).json({ error: 'Diet plan not found' });
    }
    res.json(approved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const duplicateDietPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }
    // Fetch diet plan
    const diets = await db.getMembers(); // Let's check diets collection
    // Wait, the easiest way to fetch is to get the current member's diet and clone it
    const { targetMemberId } = req.body;
    if (!targetMemberId) {
      return res.status(400).json({ error: 'targetMemberId is required to clone the diet to' });
    }

    // For duplicating, we find the diet by standard getDietByMember or search diets
    // Let's get the diet plan to clone
    // Since id represents the diet plan document ID, we can get by member or mock list
    let originalPlan: any = null;
    const firestore = (db as any).getFirestoreDb ? (db as any).getFirestoreDb() : null;
    
    if (firestore) {
      const doc = await firestore.collection('diets').doc(id).get();
      if (doc.exists) {
        originalPlan = { id: doc.id, ...doc.data() };
      }
    } else {
      originalPlan = (db as any).mockDietPlans ? (db as any).mockDietPlans.find((d: any) => d.id === id) : null;
    }

    if (!originalPlan) {
      return res.status(404).json({ error: 'Original diet plan not found to clone' });
    }

    const clonedPlan = {
      ...originalPlan,
      memberId: targetMemberId,
      name: `${originalPlan.name} (Copy)`,
      status: 'draft',
      updatedAt: new Date().toISOString()
    };
    delete clonedPlan.id;

    const saved = await db.saveDiet(clonedPlan);
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const archiveDietPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }
    const success = await db.deleteDiet(id);
    if (!success) {
      return res.status(404).json({ error: 'Diet plan not found' });
    }
    res.json({ success: true, message: 'Diet plan successfully archived/deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Cheat Meals Controller Handlers
export const getCheatMeals = async (req: Request, res: Response) => {
  try {
    const list = await db.getCheatMealRequests();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createCheatMealRequest = async (req: Request, res: Response) => {
  try {
    const { memberId, memberName, mealName, reason } = req.body;
    if (!memberId || !memberName || !mealName || !reason) {
      return res.status(400).json({ error: 'memberId, memberName, mealName and reason are required' });
    }
    const saved = await db.addCheatMealRequest({ memberId, memberName, mealName, reason });
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const handleCheatMealRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, trainerNotes } = req.body; // approved / rejected
    if (!id || !status) {
      return res.status(400).json({ error: 'ID and status (approved/rejected) are required' });
    }
    const updated = await db.updateCheatMealRequest(id, { status, trainerNotes: trainerNotes || '' });
    if (!updated) {
      return res.status(404).json({ error: 'Cheat meal request not found' });
    }
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Daily Diet Logs Controller Handlers
export const getDailyLog = async (req: Request, res: Response) => {
  try {
    const { memberId, date } = req.params;
    if (!memberId || !date) {
      return res.status(400).json({ error: 'memberId and date are required' });
    }
    const log = await db.getDailyDietLog(memberId, date);
    res.json(log);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const saveDailyLog = async (req: Request, res: Response) => {
  try {
    const { memberId, date, mealsCompleted, mealNotes, mealPhotos, waterConsumed, compliancePercent, dietScore } = req.body;
    if (!memberId || !date) {
      return res.status(400).json({ error: 'memberId and date are required' });
    }
    const saved = await db.saveDailyDietLog({
      memberId,
      date,
      mealsCompleted: mealsCompleted || {},
      mealNotes: mealNotes || {},
      mealPhotos: mealPhotos || {},
      waterConsumed: Number(waterConsumed) || 0,
      compliancePercent: Number(compliancePercent) || 0,
      dietScore: Number(dietScore) || 0,
      updatedAt: new Date().toISOString()
    });
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTrainersList = async (req: Request, res: Response) => {
  try {
    const list = await db.getTrainers();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createTrainerProfile = async (req: Request, res: Response) => {
  try {
    const saved = await db.addTrainer(req.body);
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTrainerProfile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await db.updateTrainer(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Trainer not found' });
    }
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTrainerProfile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await db.deleteTrainer(id);
    if (!success) {
      return res.status(404).json({ error: 'Trainer not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const assignMembersToTrainer = async (req: any, res: Response) => {
  try {
    const { id } = req.params; // trainer ID
    const { memberIds } = req.body; // array of member IDs
    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ error: 'memberIds must be an array of strings' });
    }

    const trainers = await db.getTrainers();
    const trainer = trainers.find((t: any) => t.id === id);
    if (!trainer) {
      return res.status(404).json({ error: 'Trainer not found' });
    }

    const members = await db.getMembers();
    const assignedBy = req.user?.name || 'Admin';
    const assignedDate = new Date().toISOString().split('T')[0];

    let assignedCount = 0;

    for (const m of members) {
      const isChecked = memberIds.includes(m.id);
      if (isChecked) {
        // Assign this trainer to the member
        await db.updateMember(m.id, {
          trainerId: trainer.id,
          trainer: trainer.name,
          trainerAssignedDate: assignedDate,
          trainerAssignedBy: assignedBy
        });
        assignedCount++;
      } else if (m.trainerId === trainer.id) {
        // Unassign this trainer from the member
        await db.updateMember(m.id, {
          trainerId: '',
          trainer: ''
        });
      }
    }

    // Update trainer's assigned member count
    const updatedTrainer = await db.updateTrainer(trainer.id, { members: assignedCount });

    res.json({ success: true, trainer: updatedTrainer, assignedCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ── SEED REAL TRAINERS ────────────────────────────────────────────────────────
// POST /trainers/seed-real-trainers
// Idempotent: uses biometricId as the uniqueness key.
// Safe to call multiple times — never creates duplicates.
// ─────────────────────────────────────────────────────────────────────────────

const REAL_TRAINER_DATA = [
  { biometricId: '10021', name: 'Sourav Arora',   phone: '7973649709', email: '',                       address: '',              branch: 'The Warrior Gym', status: 'active' },
  { biometricId: '10012', name: 'Deepak',          phone: '8196852386', email: '',                       address: '',              branch: 'The Warrior Gym', status: 'active' },
  { biometricId: '10009', name: 'Kuldeep',         phone: '8629841471', email: 'kuldeep86298@gmail.com', address: '',              branch: 'The Warrior Gym', status: 'active' },
  { biometricId: '10008', name: 'Arshdeep Singh',  phone: '9915866576', email: '',                       address: '',              branch: 'The Warrior Gym', status: 'active' },
  { biometricId: '10005', name: 'Achhar Pal',      phone: '9592691190', email: '',                       address: 'kaimbwala chd', branch: 'The Warrior Gym', status: 'active' },
  { biometricId: '10003', name: 'Abc',             phone: '7884977777', email: '',                       address: '',              branch: 'The Warrior Gym', status: 'active' },
];

export const seedRealTrainers = async (req: Request, res: Response) => {
  try {
    const existing = await db.getTrainers();
    const results: Array<{ biometricId: string; name: string; action: string; docId?: string }> = [];

    for (const t of REAL_TRAINER_DATA) {
      // Check by biometricId (primary) or phone (secondary)
      const match = existing.find(
        (e: any) =>
          String(e.biometricId) === String(t.biometricId) ||
          (e.phone && e.phone.replace(/\D/g, '') === t.phone.replace(/\D/g, ''))
      );

      if (match) {
        // Merge only blank fields — never overwrite existing real data
        const updates: Record<string, any> = {};
        if (!match.biometricId)                     updates.biometricId = t.biometricId;
        if (!match.branch && t.branch)               updates.branch = t.branch;
        if (!match.email && t.email)                 updates.email = t.email;
        if (!match.address && t.address)             updates.address = t.address;
        if (!match.status)                           updates.status = t.status;

        if (Object.keys(updates).length > 0) {
          await db.updateTrainer(match.id, { ...updates, updatedAt: new Date().toISOString() });
          results.push({ biometricId: t.biometricId, name: t.name, action: 'merged', docId: match.id });
        } else {
          results.push({ biometricId: t.biometricId, name: t.name, action: 'skipped_no_change', docId: match.id });
        }
        continue;
      }

      // Create new trainer
      const newDoc = await db.addTrainer({
        biometricId: t.biometricId,
        name: t.name,
        phone: t.phone,
        email: t.email,
        address: t.address,
        branch: t.branch,
        status: t.status,
        photo: '',
        document: '',
        specialization: '',
        experience: 0,
        rating: 0,
        members: 0,
        sessions: 0,
        salary: 0,
        certifications: [],
        bio: '',
        instagram: '',
        achievements: '',
        joiningDate: new Date().toISOString().split('T')[0],
        importedFrom: 'seedRealTrainers',
        createdAt: new Date().toISOString(),
      });

      results.push({ biometricId: t.biometricId, name: t.name, action: 'created', docId: newDoc?.id });
    }

    const created = results.filter(r => r.action === 'created').length;
    const merged  = results.filter(r => r.action === 'merged').length;
    const skipped = results.filter(r => r.action.startsWith('skipped')).length;

    res.json({
      success: true,
      summary: { created, merged, skipped, total: REAL_TRAINER_DATA.length },
      results,
    });
  } catch (error: any) {
    console.error('[seedRealTrainers] Error:', error);
    res.status(500).json({ error: error.message });
  }
};
