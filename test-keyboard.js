// Test keyboard mashing detection
const testNames = [
  "qwerty",           // Should be fake
  "asdf",             // Should be fake  
  "zxcv",             // Should be fake
  "qwertyuiop",       // Should be fake
  "asdfghjkl",        // Should be fake
  "qwerty123",        // Should be fake
  "John Smith",       // Should be real
  "qwertyuiopasdfghjklzxcvbnm", // Should be fake
  "qazwsx",           // Should be fake
  "wsxedc",           // Should be fake
  "qwertyqwerty"      // Should be fake
];

function testKeyboardMashing(name) {
  const cleanName = name.toLowerCase().replace(/\s/g, '');
  if (cleanName.length < 4) return false;
  
  const mashingPatterns = [
    "qwertyuiop", "asdfghjkl", "zxcvbnm",
    "qwertyui", "asdfghj", "zxcvbn",
    "qwerty", "asdfg", "zxcvb",
    "qwerty123", "asdf123", "zxcv123",
    "123qwerty", "123asdf", "123zxcv",
    "qwertyqwerty", "asdfasdf", "zxcvzxcv",
    "qwertyuiopasdfghjklzxcvbnm",
    "qwertyuiopasdfghjkl",
    "asdfghjklzxcvbnm"
  ];
  
  if (mashingPatterns.some(pattern => cleanName.includes(pattern))) {
    return true;
  }
  
  // Only check keyboard ratio for longer strings to avoid false positives
  if (cleanName.length >= 6) {
    const qwertyRow1 = (cleanName.match(/[qwertyuiop]/g) || []).length;
    const qwertyRow2 = (cleanName.match(/[asdfghjkl]/g) || []).length;
    const qwertyRow3 = (cleanName.match(/[zxcvbnm]/g) || []).length;
    
    const totalKeyboardChars = qwertyRow1 + qwertyRow2 + qwertyRow3;
    const keyboardRatio = totalKeyboardChars / cleanName.length;
    
    return keyboardRatio > 0.8; // Higher threshold to avoid false positives
  }
  
  return false;
}

console.log("Testing keyboard mashing detection:");
testNames.forEach(name => {
  const isMashing = testKeyboardMashing(name);
  console.log(`"${name}" -> ${isMashing ? 'FAKE (keyboard mashing)' : 'REAL'}`);
});

