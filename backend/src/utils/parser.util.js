const Tesseract = require('tesseract.js');

// 1. OCR: Convert Image Buffer to Text
exports.extractTextFromImage = async (buffer) => {
  try {
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
    return text;
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to process image");
  }
};

// Helper to escape regex special characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Comprehensive keyword mapping for DhanRekha default categories
const systemCategoryKeywords = {
  'Transport': [
    'transport', 'travel', 'uber', 'ola', 'rapido', 'taxi', 'cab', 'bus', 'train',
    'flight', 'air', 'metro', 'auto', 'fuel', 'petrol', 'diesel', 'cng', 'parking',
    'toll', 'fare', 'vehicle', 'bike', 'car', 'scooter', 'fastag'
  ],
  'Food': [
    'food', 'lunch', 'dinner', 'breakfast', 'snack', 'snacks', 'cafe', 'restaurant',
    'hotel', 'zomato', 'swiggy', 'tea', 'chai', 'coffee', 'bakery', 'meal', 'meals',
    'burger', 'pizza', 'dosa', 'samosa', 'maggi', 'sweets', 'mithai', 'dhaba'
  ],
  'Groceries': [
    'grocery', 'groceries', 'supermarket', 'mart', 'dmart', 'blinkit', 'zepto',
    'instamart', 'bigbasket', 'milk', 'vegetables', 'vegetable', 'fruits', 'fruit',
    'kirana', 'ration', 'sabzi', 'atta', 'rice', 'dal', 'oil', 'masala'
  ],
  'Rent': [
    'rent', 'house rent', 'room rent', 'flat rent', 'hostel', 'pg', 'maintenance', 'landlord'
  ],
  'Electric Bill': [
    'electricity', 'electric', 'power bill', 'current bill', 'bijli', 'electricity bill',
    'bescom', 'msedcl', 'uppcl', 'tneb', 'cesc'
  ],
  'Water Bill': [
    'water bill', 'jal board', 'water tanker', 'pani bill'
  ],
  'Cylinder': [
    'cylinder', 'lpg', 'gas cylinder', 'indane', 'bharat gas', 'hp gas', 'gas bill', 'cooking gas'
  ],
  'Internet Bill': [
    'internet', 'wifi bill', 'broadband', 'fibernet', 'act fibernet', 'airtel broadband', 'jio fiber'
  ],
  'Bills': [
    'bill', 'bills', 'recharge', 'mobile recharge', 'dth', 'postpaid', 'prepaid',
    'airtel', 'jio', 'vi', 'vodafone', 'utility'
  ],
  'Shopping': [
    'shopping', 'amazon', 'flipkart', 'myntra', 'meesho', 'ajio', 'clothes',
    'clothing', 'shoes', 'dress', 'shirt', 'pants', 'tshirt', 'mall', 'store', 'fashion'
  ],
  'Health': [
    'health', 'doctor', 'medicine', 'medicines', 'pharmacy', 'hospital', 'clinic',
    'medical', 'test', 'lab', 'apollo', 'pharmeasy', '1mg', 'dentist', 'consultation'
  ],
  'Personal Care': [
    'salon', 'haircut', 'spa', 'cosmetics', 'shampoo', 'personal care', 'skincare',
    'parlour', 'beauty', 'grooming', 'gym', 'fitness'
  ],
  'Entertainment': [
    'movie', 'cinema', 'theatre', 'netflix', 'prime', 'hotstar', 'spotify',
    'youtube', 'subscription', 'game', 'gaming', 'concert', 'outing', 'party'
  ],
  'Education': [
    'education', 'school', 'college', 'course', 'tuition', 'class', 'classes',
    'books', 'book', 'exam', 'fees', 'fee', 'udemy', 'coursera'
  ],
  'Stationery': [
    'stationery', 'pen', 'notebook', 'pencil', 'printout', 'photocopy', 'xerox',
    'paper', 'register', 'diary'
  ],
  'Investment': [
    'investment', 'invest', 'stocks', 'mutual fund', 'sip', 'trading', 'crypto',
    'gold', 'shares', 'zerodha', 'groww', 'upstox'
  ],
  'EMI': [
    'emi', 'loan', 'installment', 'credit card', 'credit card bill'
  ]
};

// 2. Parsing: Extract structured data from raw text
exports.parseExpenseText = (text, availableCategories = []) => {
  const lines = text.split(/\r?\n/);
  const expenses = [];
  const userCats = Array.isArray(availableCategories) ? availableCategories.filter(Boolean) : [];

  lines.forEach(line => {
    line = line.trim();
    if (!line) return;

    // A. Extract Date (DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD)
    const dateMatch = line.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})|(\d{4}[./-]\d{1,2}[./-]\d{1,2})/);
    let date = dateMatch ? dateMatch[0] : null;

    // Normalize date to YYYY-MM-DD
    if (date) {
      if (!date.match(/^\d{4}/)) {
        const parts = date.split(/[./-]/);
        if (parts[2].length === 2) parts[2] = '20' + parts[2];
        date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    } else {
      date = new Date().toISOString().split('T')[0];
    }

    // B. Extract Amount
    let tempLine = dateMatch ? line.replace(dateMatch[0], '') : line;
    const amountMatch = tempLine.match(/(\d+(?:\.\d{1,2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[0]) : null;

    if (!amount) return; // Skip lines without money

    // C. Extract Description & Clean Currency / Symbols
    let description = tempLine.replace(amountMatch[0], '').trim();
    description = description
      .replace(/\b(?:rs\.?|inr)\b/gi, '')
      .replace(/[₹$]/g, '')
      .replace(/^[\s\-:–—]+|[\s\-:–—]+$/g, '')
      .trim();

    const descLower = description.toLowerCase();
    let category = null;

    // Step 1: Direct match against user categories (and DhanRekha system category names)
    const directCandidates = Array.from(new Set([...userCats, ...Object.keys(systemCategoryKeywords)]))
      .sort((a, b) => b.length - a.length);

    for (const cand of directCandidates) {
      const candLower = cand.toLowerCase();
      if (
        descLower === candLower ||
        new RegExp('(^|[^a-zA-Z0-9])' + escapeRegex(candLower) + '($|[^a-zA-Z0-9])', 'i').test(description)
      ) {
        const matchedUserCat = userCats.find(c => c.toLowerCase() === candLower);
        category = matchedUserCat || cand;
        break;
      }
    }

    // Step 2: Keyword mapping match
    if (!category) {
      for (const [catName, keywords] of Object.entries(systemCategoryKeywords)) {
        const foundKw = keywords.find(kw => {
          if (kw.includes(' ')) {
            return descLower.includes(kw);
          }
          return new RegExp('(^|[^a-zA-Z0-9])' + escapeRegex(kw) + '($|[^a-zA-Z0-9])', 'i').test(description);
        });

        if (foundKw) {
          const matchedUserCat = userCats.find(c => c.toLowerCase() === catName.toLowerCase());
          category = matchedUserCat || catName;
          break;
        }
      }
    }

    // Step 3: Default to user's 'Other' category or 'Other'
    if (!category) {
      const otherCat = userCats.find(c => c.toLowerCase() === 'other');
      category = otherCat || 'Other';
    }

    expenses.push({
      date,
      amount,
      category,
      description: description || 'Scanned Expense'
    });
  });

  return expenses;
};