const Tesseract = require('tesseract.js');
const { validateCalendarDate } = require('./date.util');

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

// Month names mapping for date parsing
const monthMap = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12'
};

const monthNamesPattern = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

// 2. Parsing: Extract structured data from raw text
exports.parseExpenseText = (text, availableCategories = []) => {
  const lines = text.split(/\r?\n/);
  const expenses = [];
  const userCats = Array.isArray(availableCategories) ? availableCategories.filter(Boolean) : [];

  lines.forEach(line => {
    line = line.trim();
    if (!line) return;

    // A. Extract Date (supports DD-MMM-YYYY, DD MMM YYYY, DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD)
    let date = null;
    let matchedDateText = null;
    let parsedDay = null;
    let parsedMonth = null;
    let parsedYear = null;

    // 1. With year: DD-Month-YYYY or DD Month YYYY (e.g., 12-Sep-2026, 12 September 26)
    const nameWithYearRegex = new RegExp('(\\b\\d{1,2})[\\s./-]+(' + monthNamesPattern + ')[\\s./-]+(20\\d{2}|19\\d{2}|\\d{2})\\b', 'i');
    const nameWithYearMatch = line.match(nameWithYearRegex);

    if (nameWithYearMatch) {
      parsedDay = nameWithYearMatch[1];
      const mKey = nameWithYearMatch[2].toLowerCase();
      parsedMonth = monthMap[mKey] || '01';
      let year = nameWithYearMatch[3];
      if (year.length === 2) year = '20' + year;
      parsedYear = year;
      matchedDateText = nameWithYearMatch[0];
    } else {
      // 2. Without year: DD-Month or DD Month (e.g., 12-Sep, 12 October)
      const nameWithoutYearRegex = new RegExp('(\\b\\d{1,2})[\\s./-]+(' + monthNamesPattern + ')\\b', 'i');
      const nameWithoutYearMatch = line.match(nameWithoutYearRegex);
      if (nameWithoutYearMatch) {
        parsedDay = nameWithoutYearMatch[1];
        const mKey = nameWithoutYearMatch[2].toLowerCase();
        parsedMonth = monthMap[mKey] || '01';
        parsedYear = new Date().getFullYear();
        matchedDateText = nameWithoutYearMatch[0];
      }
    }

    // 3. Check numeric dates (DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD)
    if (!matchedDateText) {
      const numMatch = line.match(/(\b\d{1,2}[./-]\d{1,2}[./-](?:20\d{2}|19\d{2}|\d{2})\b)|(\b(?:20\d{2}|19\d{2})[./-]\d{1,2}[./-]\d{1,2}\b)/);
      if (numMatch) {
        matchedDateText = numMatch[0];
        if (!matchedDateText.match(/^\d{4}/)) {
          const parts = matchedDateText.split(/[./-]/);
          let year = parts[2];
          if (year.length === 2) year = '20' + year;
          parsedYear = year;
          parsedMonth = parts[1];
          parsedDay = parts[0];
        } else {
          const parts = matchedDateText.split(/[./-]/);
          parsedYear = parts[0];
          parsedMonth = parts[1];
          parsedDay = parts[2];
        }
      }
    }

    let isValidDate = true;
    let dateError = null;

    if (matchedDateText && parsedYear && parsedMonth && parsedDay) {
      const val = validateCalendarDate(parsedYear, parsedMonth, parsedDay);
      if (!val.isValid) {
        isValidDate = false;
        dateError = val.error;
        date = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}-${String(parsedDay).padStart(2, '0')}`;
      } else {
        date = val.isoDate;
      }
    } else {
      // Default to today if no date found in line
      const now = new Date();
      date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    // B. Extract Amount
    let tempLine = matchedDateText ? line.replace(matchedDateText, '') : line;
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
      const directRegex = new RegExp(`(^|[^a-z0-9])${escapeRegex(candLower)}([^a-z0-9]|$)`, 'i');
      if (directRegex.test(descLower)) {
        category = cand;
        description = description
          .replace(new RegExp(`(^|[^a-z0-9])${escapeRegex(cand)}([^a-z0-9]|$)`, 'gi'), ' ')
          .replace(/^[\s\-:–—]+|[\s\-:–—]+$/g, '')
          .trim();
        break;
      }
    }

    // Step 2: System Category Keyword Mapping
    if (!category) {
      for (const [catName, keywords] of Object.entries(systemCategoryKeywords)) {
        const foundKw = keywords.some(kw => {
          const kwRegex = new RegExp(`(^|[^a-z0-9])${escapeRegex(kw)}([^a-z0-9]|$)`, 'i');
          return kwRegex.test(descLower);
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
      rawDateText: matchedDateText || null,
      rawLine: line,
      isValid: isValidDate,
      dateError,
      amount,
      category,
      description: description || 'Scanned Expense'
    });
  });

  return expenses;
};