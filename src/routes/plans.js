const router = require('express').Router();
const { q } = require('../db');
const { wrap, HttpError } = require('../http');
const { requireLogin } = require('../auth');
const v = require('../validate');

router.get('/meal-plans/:goal', requireLogin, wrap(async (req, res) => {
  const goal = v.oneOf(req.params.goal, 'Goal', ['lose', 'maintain', 'gain']);
  const { rows } = await q(
    `select p.title, v.id as vid, v.slot, v.variant_no,
            f.id as fid, f.name, f.emoji, f.kcal,
            f.protein_g::float8 as protein_g, f.carbs_g::float8 as carbs_g, f.fat_g::float8 as fat_g
     from meal_plans p
     left join meal_plan_variants v on v.plan_id = p.id
     left join meal_variant_foods mf on mf.variant_id = v.id
     left join foods f on f.id = mf.food_id
     where p.goal = $1
     order by array_position(array['breakfast','lunch','snack','dinner'], v.slot), v.variant_no, f.name`,
    [goal]
  );
  if (!rows.length) throw new HttpError(404, 'No meal plan has been set up for that goal yet');

  const slots = [];
  for (const r of rows) {
    if (!r.vid) continue;
    let slot = slots.find((s) => s.slot === r.slot);
    if (!slot) slots.push((slot = { slot: r.slot, variants: [] }));
    let variant = slot.variants.find((x) => x.variantNo === r.variant_no);
    if (!variant) slot.variants.push((variant = { variantNo: r.variant_no, foods: [] }));
    if (r.fid) {
      variant.foods.push({
        id: r.fid, name: r.name, emoji: r.emoji, kcal: r.kcal,
        proteinG: r.protein_g, carbsG: r.carbs_g, fatG: r.fat_g,
      });
    }
  }
  res.json({ goal, title: rows[0].title, slots });
}));

router.get('/foods', requireLogin, wrap(async (req, res) => {
  const { rows } = await q(
    `select id, name, emoji, kcal, protein_g::float8 as "proteinG",
            carbs_g::float8 as "carbsG", fat_g::float8 as "fatG"
     from foods order by name`
  );
  res.json(rows);
}));

router.get('/products', requireLogin, wrap(async (req, res) => {
  const { rows } = await q(
    `select id, name, brand, price_egp as "priceEgp", ingredients, kcal,
            protein_g::float8 as "proteinG", verified
     from products order by name`
  );
  res.json(rows);
}));

module.exports = router;
