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

// 2. Parsing: Extract structured data from raw text
exports.parseExpenseText = (text) => {
  const lines = text.split(/\r?\n/);
  const expenses = [];

  // Keyword mapping for auto-categorization
  const categoryMap = {
    'Food': ['food', 'lunch', 'dinner', 'breakfast', 'snack', 'cafe', 'restaurant', 'zomato', 'swiggy'],
    'Travel': ['travel', 'uber', 'ola', 'taxi', 'bus', 'train', 'flight', 'fuel', 'petrol'],
    'Shopping': ['shopping', 'amazon', 'flipkart', 'myntra', 'clothes', 'shoes', 'mart'],
    'Bills': ['bill', 'electricity', 'water', 'recharge', 'mobile', 'wifi', 'broadband'],
    'Health': ['health', 'doctor', 'medicine', 'pharmacy', 'hospital'],
    'Entertainment': ['movie', 'cinema', 'netflix', 'prime', 'subscription']
  };

  lines.forEach(line => {
    line = line.trim();
    if (!line) return;

    // A. Extract Date (DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD)
    // Regex looks for patterns like 12/05/2024 or 2024-05-12
    const dateMatch = line.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})|(\d{4}[./-]\d{1,2}[./-]\d{1,2})/);
    let date = dateMatch ? dateMatch[0] : null;

    // Normalize date to YYYY-MM-DD
    if (date) {
      // Simple normalizer (assuming DD/MM/YYYY if not ISO)
      if (!date.match(/^\d{4}/)) {
        const parts = date.split(/[./-]/);
        // Handle 2-digit years (e.g., 24 -> 2024)
        if (parts[2].length === 2) parts[2] = '20' + parts[2];
        date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    } else {
      // Default to today if no date found in line
      date = new Date().toISOString().split('T')[0];
    }

    // B. Extract Amount
    // Remove the date string from the line first to avoid confusing years (2024) with amounts
    let tempLine = dateMatch ? line.replace(dateMatch[0], '') : line;
    
    // Match numbers (integer or decimal)
    const amountMatch = tempLine.match(/(\d+(?:\.\d{1,2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[0]) : null;

    if (!amount) return; // Skip lines without money

    // C. Extract Description & Category
    // Remove amount from the line to get the description
    let description = tempLine.replace(amountMatch[0], '').trim();
    // Remove common currency symbols and OCR noise
    description = description.replace(/[₹$Rs\-:]/gi, '').trim();

    let category = 'Other';
    // Check description against keywords
    for (const [cat, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(k => description.toLowerCase().includes(k))) {
        category = cat;
        break;
      }
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