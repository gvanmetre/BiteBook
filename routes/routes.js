/* routes.js */

const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const crypto = require('crypto');
const validator = require('validator');
const multer = require('multer');
const path = require('path');

// ANSI escape codes for text colors
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m"
};

const verifyUser = (req, res, next) => {
    if (!req.user || !req.user.isVerified) {
        return res.redirect('/login');
    }
    next();
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, 'public/images')
  },
  filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// Function to log user access with colored output
function logAccess(req, username = 'Unknown User') {
    const timestamp = new Date().toISOString();
    const clientIP = req.ip;
    const requestedPage = req.originalUrl;
    const coloredTimestamp = colors.cyan + timestamp + colors.reset;
    const coloredUsername = colors.magenta + username + colors.reset;
    const coloredClientIP = colors.green + clientIP + colors.reset;
    const coloredRequestedPage = colors.yellow + requestedPage + colors.reset;

    console.log(`[${coloredTimestamp}] ${coloredUsername} accessing '${coloredRequestedPage}' from ${coloredClientIP}`);
}

function logAccessString(req) {
    const timestamp = new Date().toISOString();
    const clientIP = req.ip;
    return `[${colors.cyan}${timestamp}${colors.reset}] from ${colors.green}${clientIP}${colors.reset}`;
}

// Middleware to log user access
function logUserAccess(req, res, next) {
    const username = req.user ? req.user.username : 'Unknown User';
    logAccess(req, username);
    next();
}

function verifyAdmin(req, res, next) {
  console.log('req.user.admin type:', typeof req.user.admin, 'value:', req.user.admin);
  if (!req.user || req.user.admin !== true) {
    console.log('Access denied triggered');
    return res.status(403).send('Access denied. Admins only.');
  }
  next();
}

router.use(logUserAccess);

router.get('/', function (req, res) {
	if (!req.isAuthenticated()) {
		return res.redirect('/login');
	} else if (!req.user.isVerified) {
		return res.redirect('/verify');
	} else {
		return res.redirect('/find');
	}
});

router.get('/login', (req, res) => {
	if (req.isAuthenticated()) {
		res.redirect('/');
	} else {
		const failureMessage = req.session.failureMessage;
        req.session.failureMessage = null; // Clear the session property
		res.render('login/body', {failureMessage});
	}
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
      if (err) return next(err);
      if (!user) {
          req.session.failureMessage = 'Invalid login';
          const attemptedUsername = req.body.username || 'Unknown Username';
          console.log(`${colors.red}Invalid login attempt for '${attemptedUsername}':${colors.reset}`, logAccessString(req));
          return res.redirect('/login');
      }
      req.logIn(user, err => {
          if (err) return next(err);
          return res.redirect('/');
      });
  })(req, res, next);
});

router.get('/register', function (req, res) {
    if (req.isAuthenticated()) {
        return res.redirect('/verify');
    } 
	const registrationError = req.session.registrationError;
	req.session.registrationError = null;
	res.render('register/open', { registrationError }); //change closed to open and vice versa
});

//Uncomment when open
router.post('/register', async (req, res) => {
	const { username, email, password, pswConfirm } = req.body;
	if (password !== pswConfirm) {
		req.session.registrationError = 'Passwords do not match.';
		return res.redirect('/register');
	}
	const existingUser = await User.findOne({ $or: [{ username }, { email }] });
	if (existingUser) {
		req.session.registrationError = 'Username/Email unavailable';
        return res.redirect('/register');
	}
	if (!validator.isEmail(email)) {
		req.session.registrationError = 'Invalid Email';
        return res.redirect('/register');
	}
	const verificationToken = crypto.randomBytes(32).toString('hex');
	const verificationExpires = Date.now() + 24*60*60*1000;

	User.register(new User({
		username: username,
		email: email,
		createdAt: new Date,
		verificationToken: verificationToken,
		expires: verificationExpires
		}), password, function(err, user){
		if(err){
			console.error('Registration error:', err);
            req.session.registrationError = 'Registration error';
            return res.redirect('/register');
		}
		
		// TODO: async Send email with verification link (use nodemailer or any other email sending library)
			
		passport.authenticate('local')(req, res, function(){
			res.redirect('/verify');
		});
	});
});
//Uncomment when open

router.get('/verify', function(req, res) {
	if (!req.isAuthenticated() || req.user.isVerified) {
		return res.redirect('/');
	}
	const verifyMessage = req.session.verifyMessage || 'Registration successful. Please check your email for verification link. Link expires is 24 hours and if you do not verify you will need to re-register.';
	req.session.verifyMessage = null;	
	res.render('verify/body', { user: req.user, verifyMessage });
});

router.get('/verify-email', async function(req, res) {
	if (!req.isAuthenticated() || req.user.isVerified) {
		return res.redirect('/');
	}
  const token = req.query.token;
	const tokenUsername = req.user.username;	
    if (!req.query.token) {
        req.session.verifyMessage = 'No authentication token provided';
        return res.redirect('/verify');
    }

	try {
    const user = await User.findOne({ username: tokenUsername, verificationToken: token }).exec();
    if (!user) {
        req.session.verifyMessage = 'Invalid registration token.';
        return res.redirect('/verify');
    }
    console.log('User found: ', user);
    user.isVerified = true;
    user.verificationToken = undefined;
    user.expires = undefined;
    await user.save();
    console.log('User ' + user + ' is now email verified.');
    res.redirect('/');
  } catch (error) {
      console.error('Error finding user:', error);
      return res.redirect('/verify');
  }
});

router.get('/logout', function(req, res) {
    req.session.destroy(function(err) {
        if(err) {
            console.log(err);
        } else {
            res.redirect('/login');
        }
    });
});

router.get('/recipes', verifyUser, async (req, res) => {
  try {
    const recipes = await Recipe.find({ creator: req.user._id })
      .populate('creator', 'username')
      .sort({ createdAt: -1 });

    res.render('index', {
      titleContent: 'recipes/mine/title',
      scriptContent: 'recipes/mine/scripts',
      bodyContent: 'recipes/mine/body',
      recipes,
      user: req.user,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/find', verifyUser, async (req, res) => {
  try {
    const recipes = await Recipe.find({ public: true })
      .populate('creator', 'username')
      .sort({ createdAt: -1 });

    res.render('index', {
      titleContent: 'recipes/public_recipes/title',
      scriptContent: 'recipes/public_recipes/scripts',
      bodyContent: 'recipes/public_recipes/body',
      recipes,
      user: req.user,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get("/liked", verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;

    const recipes = await Recipe.find({ likes: userId })
      .populate('creator', 'username') // populate only username
      .sort({ createdAt: -1 });
      res.render('index', {
        titleContent: 'recipes/liked/title',
        scriptContent: 'recipes/liked/scripts',
        bodyContent: 'recipes/liked/body',
        recipes,
        user: req.user,
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/recipes/filter', verifyUser, async (req, res) => {
  try {
    const {
      creator, ingredient, name, type,
      caloriesLessThan, caloriesGreaterThan,
      fatLessThan, fatGreaterThan,
      carbsLessThan, carbsGreaterThan,
      proteinLessThan, proteinGreaterThan
    } = req.query;

    let recipes = await Recipe.find({ creator: req.user._id }).populate('creator');

    // Apply text filters
    if (creator) recipes = recipes.filter(r => r.creator.username.toLowerCase().includes(creator.toLowerCase()));
    if (ingredient) {
      const tags = ingredient.split(',').map(i => i.trim().toLowerCase());
      recipes = recipes.filter(r =>
        tags.every(tag => r.ingredients.some(i => i.toLowerCase().includes(tag)))
      );
    }    
    if (name) recipes = recipes.filter(r => r.name.toLowerCase().includes(name.toLowerCase()));
    if (type) {
      const typeTags = type.split(',').map(t => t.trim().toLowerCase());
      recipes = recipes.filter(r =>
        typeTags.every(tag => r.type?.toLowerCase().includes(tag))
      );
    }    

    // Numeric filters
    const num = v => parseFloat(v);
    if (caloriesLessThan) recipes = recipes.filter(r => r.calories <= num(caloriesLessThan));
    if (caloriesGreaterThan) recipes = recipes.filter(r => r.calories >= num(caloriesGreaterThan));
    if (fatLessThan) recipes = recipes.filter(r => r.fat <= num(fatLessThan));
    if (fatGreaterThan) recipes = recipes.filter(r => r.fat >= num(fatGreaterThan));
    if (carbsLessThan) recipes = recipes.filter(r => r.carbs <= num(carbsLessThan));
    if (carbsGreaterThan) recipes = recipes.filter(r => r.carbs >= num(carbsGreaterThan));
    if (proteinLessThan) recipes = recipes.filter(r => r.protein <= num(proteinLessThan));
    if (proteinGreaterThan) recipes = recipes.filter(r => r.protein >= num(proteinGreaterThan));

    // Render only the cards partial
    res.render('recipe-cards', { recipes, user: req.user }, (err, html) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error rendering recipe cards");
      }
      res.send(html);
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/find/filter', verifyUser, async (req, res) => {
  try {
    const {
      creator, ingredient, name, type,
      caloriesLessThan, caloriesGreaterThan,
      fatLessThan, fatGreaterThan,
      carbsLessThan, carbsGreaterThan,
      proteinLessThan, proteinGreaterThan
    } = req.query;

    let recipes = await Recipe.find({ public: true }).populate('creator');

    // Apply text filters
    if (creator) recipes = recipes.filter(r => r.creator.username.toLowerCase().includes(creator.toLowerCase()));
    if (ingredient) {
      const tags = ingredient.split(',').map(i => i.trim().toLowerCase());
      recipes = recipes.filter(r =>
        tags.every(tag => r.ingredients.some(i => i.toLowerCase().includes(tag)))
      );
    }
    
    if (name) recipes = recipes.filter(r => r.name.toLowerCase().includes(name.toLowerCase()));
    if (type) {
      const typeTags = type.split(',').map(t => t.trim().toLowerCase());
      recipes = recipes.filter(r =>
        typeTags.every(tag => r.type?.toLowerCase().includes(tag))
      );
    }    

    // Numeric filters
    const num = v => parseFloat(v);
    if (caloriesLessThan) recipes = recipes.filter(r => r.calories <= num(caloriesLessThan));
    if (caloriesGreaterThan) recipes = recipes.filter(r => r.calories >= num(caloriesGreaterThan));
    if (fatLessThan) recipes = recipes.filter(r => r.fat <= num(fatLessThan));
    if (fatGreaterThan) recipes = recipes.filter(r => r.fat >= num(fatGreaterThan));
    if (carbsLessThan) recipes = recipes.filter(r => r.carbs <= num(carbsLessThan));
    if (carbsGreaterThan) recipes = recipes.filter(r => r.carbs >= num(carbsGreaterThan));
    if (proteinLessThan) recipes = recipes.filter(r => r.protein <= num(proteinLessThan));
    if (proteinGreaterThan) recipes = recipes.filter(r => r.protein >= num(proteinGreaterThan));

    // Render only the cards partial
    res.render('recipe-cards', { recipes, user: req.user }, (err, html) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error rendering recipe cards");
      }
      res.send(html);
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/liked/filter', verifyUser, async (req, res) => {
  try {
    const {
      ingredient, name, type,
      caloriesLessThan, caloriesGreaterThan,
      fatLessThan, fatGreaterThan,
      carbsLessThan, carbsGreaterThan,
      proteinLessThan, proteinGreaterThan
    } = req.query;

    // Only recipes liked by this user
    let recipes = await Recipe.find({ likes: req.user._id }).populate('creator');

    // Text filters
    if (ingredient) {
      const tags = ingredient.split(',').map(i => i.trim().toLowerCase());
      recipes = recipes.filter(r =>
        tags.every(tag => r.ingredients.some(i => i.toLowerCase().includes(tag)))
      );
    }
    if (name) recipes = recipes.filter(r => r.name.toLowerCase().includes(name.toLowerCase()));
    if (type) {
      const typeTags = type.split(',').map(t => t.trim().toLowerCase());
      recipes = recipes.filter(r =>
        typeTags.every(tag => r.type?.toLowerCase().includes(tag))
      );
    }    

    // Numeric filters
    const num = v => parseFloat(v);
    if (caloriesLessThan) recipes = recipes.filter(r => r.calories <= num(caloriesLessThan));
    if (caloriesGreaterThan) recipes = recipes.filter(r => r.calories >= num(caloriesGreaterThan));
    if (fatLessThan) recipes = recipes.filter(r => r.fat <= num(fatLessThan));
    if (fatGreaterThan) recipes = recipes.filter(r => r.fat >= num(fatGreaterThan));
    if (carbsLessThan) recipes = recipes.filter(r => r.carbs <= num(carbsLessThan));
    if (carbsGreaterThan) recipes = recipes.filter(r => r.carbs >= num(carbsGreaterThan));
    if (proteinLessThan) recipes = recipes.filter(r => r.protein <= num(proteinLessThan));
    if (proteinGreaterThan) recipes = recipes.filter(r => r.protein >= num(proteinGreaterThan));

    // Render only the recipe cards partial
    res.render('recipe-cards', { recipes, user: req.user }, (err, html) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error rendering recipe cards");
      }
      res.send(html);
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/find/all-ingredients', verifyUser, async (req, res) => {
  try {
    const recipes = await Recipe.find({ public: true }).select('ingredients -_id');
    const ingredientSet = new Set();
    recipes.forEach(r => r.ingredients.forEach(i => ingredientSet.add(i)));
    res.json(Array.from(ingredientSet));
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

router.get('/find/all-types', verifyUser, async (req, res) => {
  try {
    const recipes = await Recipe.find({ public: true }).select('type -_id');
    const set = new Set();
    recipes.forEach(r => set.add(r.type));
    res.json(Array.from(set));
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

router.get('/recipes/add', verifyUser, function (req, res) {
  res.render('index', { 
      titleContent: 'recipes/add/title', 
      scriptContent: 'blank', 
      bodyContent: 'recipes/add/body',
      user: req.user
  });
});

router.post('/recipes/add', verifyUser, upload.single('image'), async (req, res) => {
  try {
    const {
      name, type, calories, carbs, fat, protein, instructions,
      fiber, sugar, saturatedFat, transFat, polyunsaturatedFat,
      monounsaturatedFat, sodium, potassium, cholesterol,
      calcium, iron, servings, servingSize
    } = req.body;

    const isPublic = req.body.public === 'on';
    const errors = [];

    let ingredientsParsed = [];
    try {
      ingredientsParsed = JSON.parse(req.body.ingredients || "[]");
    } catch {
      errors.push("Invalid ingredient data format.");
    }

    if (!Array.isArray(ingredientsParsed) || ingredientsParsed.length === 0) {
      errors.push("You must add at least one ingredient.");
    }

    // Validate ingredients
    ingredientsParsed.forEach((ing, i) => {
      if (!ing.name || !ing.amount) {
        errors.push(`Ingredient #${i + 1} is missing a name or amount.`);
      }
      if (isNaN(parseFloat(ing.amount))) {
        errors.push(`Ingredient #${i + 1} amount must be numeric.`);
      }
    });

    // Required numeric fields
    const requiredNumeric = { calories, carbs, fat, protein };
    for (const [field, value] of Object.entries(requiredNumeric)) {
      if (!value || isNaN(parseFloat(value))) {
        errors.push(`${field} must be a valid number.`);
      }
    }

    // Optional numeric fields
    const optionalNumeric = {
      fiber, sugar, saturatedFat, transFat, sodium, potassium, cholesterol,
      calcium, iron, servings
    };

    for (const [field, value] of Object.entries(optionalNumeric)) {
      if (value && isNaN(parseFloat(value))) {
        errors.push(`${field} must be a number.`);
      }
    }

    // Image validation
    if (req.file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        errors.push("Image must be JPG, PNG, GIF, or WEBP.");
      }
      if (req.file.size > 1024 * 1024) {
        errors.push("Image must be under 1MB.");
      }
    }

    // Errors
    if (errors.length > 0) {
      return res.status(400).render('add/body', {
        errors,
        formData: req.body
      });
    }

    // Save recipe
    const newRecipe = new Recipe({
      name,
      type,
      creator: req.user._id,

      calories: parseFloat(calories),
      carbs: parseFloat(carbs),
      fat: parseFloat(fat),
      protein: parseFloat(protein),

      fiber: parseFloat(fiber) || undefined,
      sugar: parseFloat(sugar) || undefined,
      saturatedFat: parseFloat(saturatedFat) || undefined,
      transFat: parseFloat(transFat) || undefined,

      sodium: parseFloat(sodium) || undefined,
      potassium: parseFloat(potassium) || undefined,
      cholesterol: parseFloat(cholesterol) || undefined,
      calcium: parseFloat(calcium) || undefined,
      iron: parseFloat(iron) || undefined,

      servings: parseFloat(servings) || undefined,
      servingSize,

      ingredients: ingredientsParsed,
      instructions,

      image: req.file ? "/images/" + req.file.filename : "/images/default.png",

      public: isPublic
    });

    await newRecipe.save();

    await User.findByIdAndUpdate(req.user._id, {
      $push: { recipes: newRecipe._id }
    });

    res.redirect('/recipes');

  } catch (err) {
    console.error("Error adding recipe:", err);
    res.status(500).send("Server error adding recipe");
  }
});

router.get('/recipes/edit/:id', verifyUser, async (req, res) => {
  try {
      const recipe = await Recipe.findById(req.params.id);
      if (!recipe) return res.status(404).send('Recipe not found');

      // Allow owner OR admin
      if (recipe.creator.toString() !== req.user._id.toString() && !req.user.admin) {
          return res.status(403).send('Unauthorized');
      }

      res.render('index', {
          titleContent: 'recipes/edit/title',
          scriptContent: 'recipes/edit/scripts',
          bodyContent: 'recipes/edit/body',
          recipe,
          user: req.user
      });
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
  }
});


router.post('/recipes/edit/:id', verifyUser, upload.single('image'), async (req, res) => {
  try {
    const { name, type, calories, carbs, fat, protein, ingredients, instructions, public } = req.body;
    const ingredientArray = ingredients.split('\n').map(i => i.trim());

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    // Allow owner OR admin
    if (recipe.creator.toString() !== req.user._id.toString() && !req.user.admin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    recipe.name = name;
    recipe.type = type;
    recipe.calories = calories;
    recipe.carbs = carbs;
    recipe.fat = fat;
    recipe.protein = protein;
    recipe.ingredients = ingredientArray;
    recipe.instructions = instructions;
    recipe.public = public === 'on';

    if (req.file) {
      recipe.image = '/images/' + req.file.filename;
    }

    await recipe.save();
    res.redirect('/recipes');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


router.post('/recipes/delete/:id', verifyUser, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).send('Recipe not found');

    if (recipe.creator.toString() !== req.user._id.toString() && !req.user.admin) {
      return res.status(403).send('Unauthorized');
    }

    await Recipe.findByIdAndDelete(req.params.id);

    await User.findByIdAndUpdate(recipe.creator, {
      $pull: { recipes: req.params.id }
    });

    if (req.user.admin) {
      return res.redirect('/admin');
    }

    res.redirect('/recipes');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/recipes/share/:id', verifyUser, async (req, res) => {
  try {
    const recipeId = req.params.id;
    const { username } = req.body;
    const targetUser = await User.findOne({ username: username.toLowerCase() });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (!targetUser.recipes.includes(recipeId)) {
      targetUser.recipes.push(recipeId);
      await targetUser.save();
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/user/:id', verifyUser, async (req, res) => {
  try {
    const profile = await User.findById(req.params.id).select('username avatar bio');
    if (!profile) return res.status(404).send('User not found');

    // Only public recipes
    const recipes = await Recipe.find({ creator: profile._id, public: true }).sort({ createdAt: -1 });

    res.render('index', {
      titleContent: 'user/title',
      bodyContent: 'user/body',
      scriptContent: 'blank',
      profile,
      recipes,
      user: req.user
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.get('/user/edit/:id', verifyUser, async (req, res) => {
  if (req.params.id !== req.user._id.toString()) {
    return res.status(403).send('You cannot edit this profile');
  }

  res.render('index', {
    titleContent: 'profile/title',
    bodyContent: 'profile/body', 
    scriptContent: 'profile/scripts',
    user: req.user,
    error: '',
    success: ''
  });
});

// POST updated profile
router.post('/user/edit/:id', verifyUser, upload.single('avatar'), async (req, res) => {
  if (req.params.id !== req.user._id.toString()) {
    return res.status(403).send('You cannot edit this profile');
  }

  try {
    const { email, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    const valid = await user.authenticate(currentPassword);
    if (!valid.user) {
      return res.render('index', {
        titleContent: 'profile/title',
        bodyContent: 'profile/body',
        scriptContent: 'profile/scripts',
        user: req.user,
        error: 'Current password is incorrect',
        success: ''
      });
    }

    if (req.file) user.avatar = `/images/${req.file.filename}`;
    if (email) user.email = email;
    if (newPassword) await user.setPassword(newPassword);

    await user.save();

    res.render('index', {
      titleContent: 'profile/title',
      bodyContent: 'profile/body',
      scriptContent: 'profile/scripts',
      user,
      error: '',
      success: 'Profile updated successfully!'
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.get('/recipes/:id', verifyUser, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id)
      .populate('creator', 'username avatar')
      .populate('comments.user', 'username avatar');
    if (!recipe) return res.status(404).send("Recipe not found");

    recipe.comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Access check
    const isOwner = recipe.creator && recipe.creator._id.equals(req.user._id);
    if (!recipe.public && !isOwner) {
      return res.status(403).send("You do not have access to this recipe");
    }

    res.render('index', {
      titleContent: 'recipes/full/title',
      scriptContent: 'blank',
      bodyContent: 'recipes/full/body',
      recipe,
      user: req.user
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

router.post("/recipes/:id/like", async (req, res) => {
  try {
    const userId = req.user._id;
    const recipeId = req.params.id;

    const recipe = await Recipe.findById(recipeId);

    if (!recipe) {
      return res.status(404).json({ success: false, message: "Recipe not found" });
    }

    const alreadyLiked = recipe.likes.some(
      id => id.toString() === userId.toString()
    );

    let liked;

    if (alreadyLiked) {
      // UNLIKE
      await Recipe.findByIdAndUpdate(recipeId, {
        $pull: { likes: userId }
      });
      liked = false;
    } else {
      // LIKE
      await Recipe.findByIdAndUpdate(recipeId, {
        $push: { likes: userId }
      });
      liked = true;
    }

    const updated = await Recipe.findById(recipeId);

    res.json({
      success: true,
      liked,
      likeCount: updated.likes.length
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post('/recipes/:id/comments', verifyUser, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ success: false, error: 'Recipe not found' });

    const text = req.body.text?.trim();
    if (!text || text.length > 500) {
      return res.status(400).json({ success: false, error: 'Invalid comment text' });
    }

    const newComment = {
      text,
      user: req.user._id,
      createdAt: new Date(),
      likes: []
    };

    recipe.comments.push(newComment);
    await recipe.save();

    // Include full user info in response
    const commentToSend = {
      _id: newComment._id,
      text: newComment.text,
      createdAt: newComment.createdAt,
      likes: newComment.likes,
      user: {
        _id: req.user._id,
        username: req.user.username,
        avatar: req.user.avatar || ''
      }
    };

    console.log(`Comment ${commentToSend._id} added by user ${req.user._id}`);
    res.json({ success: true, comment: commentToSend });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.put('/recipes/:id/comments/:commentId', verifyUser, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    const comment = recipe.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (comment.user.toString() !== req.user._id.toString() && !req.user.isAdmin)
      return res.status(403).json({ error: 'Not authorized' });

    comment.text = req.body.text;
    await recipe.save();
    console.log(`Comment ${comment._id} edited by user ${req.user._id}`);
    res.json({ success: true, comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/recipes/:id/comments/:commentId', verifyUser, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    const comment = recipe.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (comment.user.toString() !== req.user._id.toString() && !req.user.isAdmin)
      return res.status(403).json({ error: 'Not authorized' });
      recipe.comments.pull(comment._id);

    await recipe.save();
    console.log(`Comment ${comment._id} deleted by user ${req.user._id}`);
    res.json({ success: true, commentId: req.params.commentId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/recipes/:recipeId/comments/:commentId/like', verifyUser, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.recipeId);
    if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });

    const comment = recipe.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    const userId = req.user._id.toString();
    const index = comment.likes.findIndex(u => u.toString() === userId);

    let liked = false;
    if (index > -1) {
      comment.likes.splice(index, 1);
    } else {
      comment.likes.push(req.user._id);
      liked = true;
    }

    await recipe.save();

    res.json({
      success: true,
      liked,
      likeCount: comment.likes.length
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

router.get('/admin', verifyUser, verifyAdmin, async (req, res) => {
  const users = await User.find().sort({ username: 1 });
  res.render('index', {
    titleContent: 'admin/title',
    scriptContent: 'admin/scripts',
    bodyContent: 'admin/body',
    users,
    user: req.user
  });
});


router.get('/admin/edit/:id', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const editUser = await User.findById(req.params.id)
      .populate('recipes');

    if (!editUser) return res.status(404).send('User not found');

    const recipes = await Recipe.find().populate('comments.user');

    const userComments = [];

    recipes.forEach(recipe => {
      recipe.comments.forEach(comment => {
        if (comment.user && comment.user._id.toString() === editUser._id.toString()) {
          userComments.push({
            _id: comment._id,
            text: comment.text,
            recipeId: recipe._id,
            recipeName: recipe.name,
            createdAt: comment.createdAt
          });
        }
      });
    });

    userComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.render('index', {
      titleContent: 'admin/edit/title',
      scriptContent: 'admin/edit/scripts',
      bodyContent: 'admin/edit/body',
      editUser,
      userComments,
      user: req.user
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

router.post('/admin/edit/:id', verifyUser, verifyAdmin, upload.single('avatar'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');

    user.username = req.body.username;
    user.email = req.body.email;

    user.admin = req.body.admin ? true : false;

    const days = parseInt(req.body.suspendDays);
    if (!isNaN(days) && days > 0) {
      const now = new Date();
      user.suspendedUntil = new Date(now.getTime() + days * 86400000);
    } else {
      user.suspendedUntil = null;
    }

    if (req.body.removeAvatar === "true") {
      user.avatar = null;
    }

    if (req.file) {
      user.avatar = `/images/${req.file.filename}`;
    }

    await user.save();
    res.redirect(`/admin/edit/${req.params.id}`);

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
}
);

router.post('/admin/delete/:id', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    console.log(`Audit log: Admin ${req.user.username} deleted user ${deletedUser.username}`);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

/*
router.get('/admin/fix-recipes', async (req, res) => {
  try {
    const users = await User.find();
    
    for (const user of users) {
      const ownedRecipes = await Recipe.find({ creator: user._id }).select('_id');
      user.recipes = ownedRecipes.map(r => r._id);
      await user.save();
    }

    res.send("Users' recipe lists rebuilt successfully.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error rebuilding recipes.");
  }
});
*/

module.exports = router;