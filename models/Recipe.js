/* Recipe.js */

const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now }
});

const ingredientSchema = new mongoose.Schema({
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    unit: { type: String, default: "" }
});

const recipeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    type: { type: String, required: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    image: { type: String, required: true },
    ingredients: [ingredientSchema],
    instructions: { type: String },
    servings: { type: Number, required: true },
    servingSize: { type: String, required: true },
    calories: { type: Number, required: true },
    carbs: { type: Number, required: true },
    fat: { type: Number, required: true },
    protein: { type: Number, required: true },

    fiber: Number,
    sugar: Number,
    saturatedFat: Number,
    transFat: Number,
    sodium: Number,
    potassium: Number,
    cholesterol: Number,
    calcium: Number,
    iron: Number,

    servings: { type: Number, required: true },
    servingSize: { type: String, required: true },

    public: { type: Boolean, default: false },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    likeCount: { type: Number, default: 0 },
    comments: [commentSchema]
});

recipeSchema.pre('save', function (next) {
    if (this.ingredients && this.ingredients.length > 0) {
        this.ingredients = this.ingredients.map(ing => {
            return {
                ...ing,
                name: ing.name
                    .trim()
                    .toLowerCase()
                    .replace(/\b\w/g, c => c.toUpperCase())
            };
        });
    }
    next();
});

module.exports = mongoose.model('Recipe', recipeSchema);
