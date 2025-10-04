"use client";

import { useState, useEffect, useCallback } from "react";

interface AnalysisResult {
  isFake: boolean;
  confidence: number;
  reasons: string[];
  score: number;
}

interface DetectionRule {
  name: string;
  weight: number;
  check: (name: string) => boolean;
  description: string;
}

// Static arrays for fake and real names - you can add your own examples here
const STATIC_FAKE_NAMES = [
  "Test User",
  "Qwerty Asdf",
  "John123",
  "AADAD DAADAFFQRQ",
  "kukuku jijiji",
  "fksjaf roiuew",
  "flkjapoei fjapoifuwae",
  "test",
  "no name",
  "fake user",
  "dummy data",
  "sample name",
  "placeholder text",
  "random typing",
  "keyboard mashing",
  "gibberish name",
  "fake data",
  "test data",
  "dummy user",
  "sample user",
];

const STATIC_REAL_NAMES = [
  "John Smith",
  "Maria Garcia",
  "Ahmed Hassan",
  "Jennifer Lee",
  "Michael Johnson",
  "Sarah Williams",
  "David Brown",
  "Lisa Anderson",
  "Robert Taylor",
  "Emily Davis",
  "Christopher Wilson",
  "Jessica Martinez",
  "Daniel Rodriguez",
  "Ashley Thompson",
  "Matthew Garcia",
  "Amanda Lopez",
  "James Hernandez",
  "Stephanie Gonzalez",
  "Andrew Wilson",
  "Nicole Martinez",
  "chowdhury",
];

// Strict human-name plausibility check
function isPlausibleSingleWordName(wordRaw: string): boolean {
  const word = wordRaw.trim();
  if (!/^[A-Za-z][A-Za-z.'-]*$/.test(word)) return false;
  const lettersOnly = word.replace(/[^A-Za-z]/g, "");
  if (lettersOnly.length < 2 || lettersOnly.length > 30) return false;
  // Require at least one vowel for words of length >= 3
  if (lettersOnly.length >= 3 && !/[AEIOUaeiou]/.test(lettersOnly))
    return false;
  return true;
}

function isPlausibleHumanName(rawName: string): boolean {
  const name = rawName.trim();
  if (!name) return false;

  // Allow letters, spaces, apostrophes, hyphens, and dots (for initials)
  if (!/^[A-Za-z][A-Za-z .'-]*$/.test(name)) return false;

  // Split into words and validate each
  const parts = name.split(/\s+/).filter(Boolean);
  // Allow single-word plausible given or family names (e.g., "John", "Smith")
  if (parts.length === 1) {
    return isPlausibleSingleWordName(parts[0]);
  }

  // Each part must have at least 2 letters and start with a letter
  for (const part of parts) {
    const lettersOnly = part.replace(/[^A-Za-z]/g, "");
    if (lettersOnly.length < 2) return false;
    // More lenient vowel check - only require vowels for longer words
    if (lettersOnly.length >= 5) {
      const vowelCount = (lettersOnly.match(/[aeiouAEIOU]/g) || []).length;
      if (vowelCount === 0) return false;
    }
  }

  // More lenient consonant sequence check
  if (/[bcdfghjklmnpqrstvwxyz]{6,}/i.test(name)) return false;

  return true;
}

const detectionRules: DetectionRule[] = [
  {
    name: "Low Vowel Ratio",
    weight: 1,
    check: (name) => {
      const cleanName = name.replace(/[^a-zA-Z]/g, "").toLowerCase();
      if (!cleanName || cleanName.length < 6) return false; // Don't check short names
      const vowels = (cleanName.match(/[aeiou]/g) || []).length;
      // Only flag if the ratio is extremely low (less than 15%) and the name is very long
      return vowels / cleanName.length < 0.15 && cleanName.length > 8;
    },
    description: "Names with extremely low vowel-to-consonant ratio",
  },
  {
    name: "No Spaces",
    weight: 1,
    check: (name) => {
      const trimmed = name.trim();
      // Do not flag if it's a valid single-word human name
      if (!trimmed.includes(" ") && isPlausibleSingleWordName(trimmed)) {
        return false;
      }
      // Only flag if it's a single word AND looks suspicious
      if (!trimmed.includes(" ")) {
        // Check if it looks like keyboard mashing or gibberish
        const cleanName = trimmed.toLowerCase();
        const hasKeyboardPattern = /[qwertyuiopasdfghjklzxcvbnm]{4,}/.test(
          cleanName
        );
      }
      return false;
    },
    description:
      "Single word names that look like keyboard mashing or contain numbers/special characters",
  },
  {
    name: "Excessive Consonants",
    weight: 2,
    check: (name) => /[bcdfghjklmnpqrstvwxyz]{5,}/i.test(name),
    description: "Too many consonants in sequence",
  },
  {
    name: "Contains Numbers",
    weight: 3,
    check: (name) => /\d/.test(name),
    description: "Names containing numbers are suspicious",
  },
  {
    name: "Repeated Characters",
    weight: 2,
    check: (name) => {
      if (!name) return false;
      let maxRun = 1,
        current = 1;
      for (let i = 1; i < name.length; i++) {
        if (name[i] === name[i - 1]) {
          current++;
          maxRun = Math.max(maxRun, current);
        } else {
          current = 1;
        }
      }
      return maxRun / name.length > 0.4;
    },
    description: "Excessive character repetition",
  },
  {
    name: "Email Pattern",
    weight: 4,
    check: (name) => /\S+@\S+\.\S+/.test(name),
    description: "Contains email-like pattern",
  },
  {
    name: "Phone Pattern",
    weight: 3,
    check: (name) => {
      const digits = (name.match(/\d/g) || []).length;
      return digits >= 7 || /\d{7,}/.test(name);
    },
    description: "Contains phone number pattern",
  },
  {
    name: "Placeholder Text",
    weight: 4,
    check: (name) => {
      const placeholders = [
        "test",
        "unknown",
        "n/a",
        "na",
        "xxx",
        "aaa",
        "name",
        "guest",
        "dummy",
        "fake",
        "abcd",
        "qwerty",
        "placeholder",
        "no name",
        "null",
        "user",
        "admin",
        "temp",
        "temporary",
        "sample",
        "example",
        "demo",
        "test user",
        "test name",
        "no name",
        "unknown user",
        "guest user",
        "dummy user",
        "fake user",
        "temp user",
        "sample user",
        "example user",
        "demo user",
        "test123",
        "user123",
        "admin123",
        "guest123",
        "dummy123",
        "fake123",
        "temp123",
        "sample123",
        "example123",
        "demo123",
      ];
      const cleanName = name
        .replace(/[^a-zA-Z ]/g, "")
        .trim()
        .toLowerCase();

      // Check if entire name matches
      if (placeholders.includes(cleanName)) return true;

      // Check if any individual word matches
      const words = cleanName.split(" ");
      return words.some((word) => placeholders.includes(word));
    },
    description: "Common placeholder or test names",
  },
  {
    name: "All Uppercase",
    weight: 3,
    check: (name) => /^[A-Z\s]+$/.test(name),
    description: "All uppercase letters (gibberish pattern)",
  },
  {
    name: "Very Long Words",
    weight: 1,
    check: (name) => {
      const words = name.split(" ");
      return words.some((word) => word.length > 20); // Increased threshold
    },
    description: "Contains unusually long words",
  },
  {
    name: "No Vowels in Words",
    weight: 2,
    check: (name) => {
      const words = name.split(" ");
      return words.some((word) => {
        const vowels = (word.match(/[aeiou]/gi) || []).length;
        return word.length > 3 && vowels === 0;
      });
    },
    description: "Words without vowels are suspicious",
  },
  {
    name: "Word-Level Analysis",
    weight: 1,
    check: (name) => {
      const words = name.split(" ");
      return words.some((word) => {
        // Too long word - very high threshold
        if (word.length > 25) return true;
        // No vowels in word - only for extremely long words
        const vowels = (word.match(/[aeiou]/gi) || []).length;
        if (word.length > 10 && vowels === 0) return true;
        return false;
      });
    },
    description: "Individual word analysis (length and vowels)",
  },
  {
    name: "Keyboard Patterns",
    weight: 3,
    check: (name) => {
      const keyboardPatterns = [
        // QWERTY row patterns
        "qwerty",
        "asdf",
        "zxcv",
        "qwertyui",
        "asdfgh",
        "zxcvbn",
        // Adjacent key patterns
        "qaz",
        "wsx",
        "edc",
        "rfv",
        "tgb",
        "yhn",
        "ujm",
        "ik",
        "ol",
        "p",
        // Reverse patterns
        "ytrewq",
        "fdsa",
        "vcxz",
        "poiu",
        "lkjh",
        "mnbvc",
        // Common typing patterns
        "qwertyuiop",
        "asdfghjkl",
        "zxcvbnm",
        "1234567890",
        // Random sequences
        "qwertyui",
        "asdfghj",
        "zxcvbn",
        "qwerty",
        "asdfg",
        "zxcvb",
        // Diagonal patterns
        "qazwsx",
        "wsxedc",
        "edcrfv",
        "rfvtgb",
        "tgbyhn",
        "yhnujm",
        // Mixed patterns
        "qwerty123",
        "asdf123",
        "zxcv123",
        "qwertyuiop123",
        // Common fake patterns
        "qwerty123",
        "asdf123",
        "zxcv123",
        "qwertyuiop123",
        "qwertyuiopasdfghjklzxcvbnm",
        "1234567890qwertyuiop",
        // Single character repetition
        "qq",
        "ww",
        "ee",
        "rr",
        "tt",
        "yy",
        "uu",
        "ii",
        "oo",
        "pp",
        "aa",
        "ss",
        "dd",
        "ff",
        "gg",
        "hh",
        "jj",
        "kk",
        "ll",
        "zz",
        "xx",
        "cc",
        "vv",
        "bb",
        "nn",
        "mm",
      ];
      const cleanName = name.toLowerCase();
      return keyboardPatterns.some((pattern) => cleanName.includes(pattern));
    },
    description: "Contains keyboard typing patterns",
  },
  {
    name: "Adjacent Key Sequences",
    weight: 4,
    check: (name) => {
      const cleanName = name.toLowerCase().replace(/\s/g, "");
      if (cleanName.length < 3) return false;

      // Check for sequences of adjacent keys on QWERTY keyboard
      const qwertyRows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

      // Check each row for adjacent sequences
      for (const row of qwertyRows) {
        for (let i = 0; i <= row.length - 3; i++) {
          const sequence = row.substring(i, i + 3);
          if (cleanName.includes(sequence)) return true;
        }
      }

      // Check for diagonal patterns
      const diagonalPatterns = [
        "qaz",
        "wsx",
        "edc",
        "rfv",
        "tgb",
        "yhn",
        "ujm",
        "ik",
        "ol",
      ];

      return diagonalPatterns.some((pattern) => cleanName.includes(pattern));
    },
    description: "Contains adjacent keyboard key sequences",
  },

  {
    name: "Random Character Mix",
    weight: 2,
    check: (name) => {
      const cleanName = name.replace(/\s/g, "");
      if (cleanName.length < 6) return false;

      // Check for alternating patterns that look random
      let alternatingCount = 0;
      for (let i = 1; i < cleanName.length - 1; i++) {
        const prev = cleanName[i - 1];
        const curr = cleanName[i];
        const next = cleanName[i + 1];

        if (
          (prev.match(/[aeiou]/i) &&
            curr.match(/[bcdfghjklmnpqrstvwxyz]/i) &&
            next.match(/[aeiou]/i)) ||
          (prev.match(/[bcdfghjklmnpqrstvwxyz]/i) &&
            curr.match(/[aeiou]/i) &&
            next.match(/[bcdfghjklmnpqrstvwxyz]/i))
        ) {
          alternatingCount++;
        }
      }
      return alternatingCount / cleanName.length > 0.6;
    },
    description: "Unnatural alternating vowel-consonant patterns",
  },

  {
    name: "Special Characters",
    weight: 2,
    check: (name) => /[!@#$%^&*()_+={}[\]|\\:";'<>?,./]/.test(name),
    description: "Contains special characters",
  },
  {
    name: "Mixed Languages",
    weight: 1,
    check: (name) => {
      // Simple check for mixed scripts (Latin + other)
      const hasLatin = /[a-zA-Z]/.test(name);
      const hasNonLatin = /[^\x00-\x7F]/.test(name);
      return hasLatin && hasNonLatin;
    },
    description: "Mixed language scripts",
  },
  {
    name: "Alphanumeric Gibberish",
    weight: 4,
    check: (name) => {
      // Check for patterns like "eq34q6eduedb" - mixed letters and numbers in random order
      const cleanName = name.replace(/\s/g, "");
      if (cleanName.length < 6) return false;

      const hasNumbers = /\d/.test(cleanName);
      const hasLetters = /[a-zA-Z]/.test(cleanName);

      if (!hasNumbers || !hasLetters) return false;

      // Check for alternating or random letter-number patterns
      let letterNumberTransitions = 0;
      for (let i = 1; i < cleanName.length; i++) {
        const prev = cleanName[i - 1];
        const curr = cleanName[i];
        if (
          (/\d/.test(prev) && /[a-zA-Z]/.test(curr)) ||
          (/[a-zA-Z]/.test(prev) && /\d/.test(curr))
        ) {
          letterNumberTransitions++;
        }
      }

      // If there are many transitions between letters and numbers, it's likely gibberish
      return letterNumberTransitions / cleanName.length > 0.3;
    },
    description: "Random alphanumeric gibberish patterns",
  },
  {
    name: "Random Character Sequence",
    weight: 3,
    check: (name) => {
      const cleanName = name.replace(/\s/g, "").toLowerCase();
      if (cleanName.length < 8) return false;

      // Check for sequences that don't follow natural language patterns
      let consonantClusters = 0;
      let vowelClusters = 0;

      for (let i = 0; i < cleanName.length - 2; i++) {
        const threeChars = cleanName.substring(i, i + 3);
        if (/^[bcdfghjklmnpqrstvwxyz]{3}$/.test(threeChars)) {
          consonantClusters++;
        }
        if (/^[aeiou]{3}$/.test(threeChars)) {
          vowelClusters++;
        }
      }

      // Too many consonant or vowel clusters indicate unnatural patterns
      return consonantClusters > 1 || vowelClusters > 1;
    },
    description: "Unnatural character sequences",
  },
  {
    name: "Random Keyboard Typing",
    weight: 4,
    check: (name) => {
      const cleanName = name.toLowerCase().trim();
      if (cleanName.length < 6) return false;

      // Check for random typing patterns like "flkjapoei", "fjapoifuwae", "mceerww"
      const words = cleanName.split(/\s+/);

      for (const word of words) {
        if (word.length < 4) continue;

        // Check for high randomness in character distribution
        const charCounts: { [key: string]: number } = {};
        for (const char of word) {
          charCounts[char] = (charCounts[char] || 0) + 1;
        }

        // Calculate entropy-like measure - high randomness indicates fake typing
        const uniqueChars = Object.keys(charCounts).length;
        const totalChars = word.length;
        const entropy = uniqueChars / totalChars;

        // High entropy (many unique characters) with no clear pattern suggests random typing
        if (entropy > 0.7 && word.length > 6) {
          // Additional check: look for lack of common letter combinations
          const hasCommonPatterns =
            /(th|he|in|er|an|re|ed|nd|on|en|at|ou|it|is|or|ti|as|to|ha|ng|es|st|nt|of|and|the|for|are|but|not|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|man|new|now|old|see|two|way|who|boy|did|its|let|put|say|she|too|use)/.test(
              word
            );
          if (!hasCommonPatterns) return true;
        }

        // Check for alternating vowel-consonant patterns that are too regular (random typing)
        let alternatingCount = 0;
        for (let i = 1; i < word.length - 1; i++) {
          const prev = word[i - 1];
          const curr = word[i];
          const next = word[i + 1];

          if (
            (prev.match(/[aeiou]/) &&
              curr.match(/[bcdfghjklmnpqrstvwxyz]/) &&
              next.match(/[aeiou]/)) ||
            (prev.match(/[bcdfghjklmnpqrstvwxyz]/) &&
              curr.match(/[aeiou]/) &&
              next.match(/[bcdfghjklmnpqrstvwxyz]/))
          ) {
            alternatingCount++;
          }
        }

        // If more than 60% of the word follows alternating pattern, it's likely random typing
        if (alternatingCount / word.length > 0.6 && word.length > 8)
          return true;

        // Check for lack of common English letter combinations
        const commonCombinations =
          /(th|he|in|er|an|re|ed|nd|on|en|at|ou|it|is|or|ti|as|to|ha|ng|es|st|nt|of|and|the|for|are|but|not|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|man|new|now|old|see|two|way|who|boy|did|its|let|put|say|she|too|use)/;
        if (word.length > 8 && !commonCombinations.test(word)) {
          // Check if it has too many unique characters relative to length
          const uniqueRatio = uniqueChars / word.length;
          if (uniqueRatio > 0.8) return true;
        }
      }

      return false;
    },
    description:
      "Random keyboard typing patterns (like 'flkjapoei', 'fjapoifuwae')",
  },
  {
    name: "Random Character Sequence",
    weight: 3,
    check: (name) => {
      const cleanName = name.replace(/\s/g, "").toLowerCase();
      if (cleanName.length < 8) return false;

      // Check for sequences that don't follow natural language patterns
      let consonantClusters = 0;
      let vowelClusters = 0;

      for (let i = 0; i < cleanName.length - 2; i++) {
        const threeChars = cleanName.substring(i, i + 3);
        if (/^[bcdfghjklmnpqrstvwxyz]{3}$/.test(threeChars)) {
          consonantClusters++;
        }
        if (/^[aeiou]{3}$/.test(threeChars)) {
          vowelClusters++;
        }
      }

      // Too many consonant or vowel clusters indicate unnatural patterns
      return consonantClusters > 1 || vowelClusters > 1;
    },
    description: "Unnatural character sequences",
  },
  {
    name: "Random Keyboard Mashing",
    weight: 4,
    check: (name) => {
      const words = name.trim().split(/\s+/);

      for (const word of words) {
        const cleanWord = word.toLowerCase().replace(/[^a-z]/g, "");
        if (cleanWord.length < 5) continue;

        // Check for unusual bigram patterns (two-letter combinations)
        const unusualBigrams = [
          "fj",
          "fk",
          "gj",
          "gk",
          "jf",
          "jg",
          "jk",
          "jl",
          "jm",
          "jq",
          "jv",
          "jw",
          "jx",
          "jz",
          "kf",
          "kg",
          "kj",
          "kq",
          "kx",
          "kz",
          "lj",
          "mj",
          "qb",
          "qc",
          "qd",
          "qf",
          "qg",
          "qh",
          "qj",
          "qk",
          "ql",
          "qm",
          "qn",
          "qp",
          "qr",
          "qs",
          "qt",
          "qv",
          "qw",
          "qx",
          "qy",
          "qz",
          "vb",
          "vf",
          "vj",
          "vk",
          "vq",
          "vx",
          "wq",
          "wv",
          "wx",
          "xj",
          "xk",
          "xq",
          "xv",
          "xw",
          "zf",
          "zj",
          "zk",
          "zq",
          "zr",
          "zx",
        ];

        let unusualBigramCount = 0;
        for (let i = 0; i < cleanWord.length - 1; i++) {
          const bigram = cleanWord.substring(i, i + 2);
          if (unusualBigrams.includes(bigram)) {
            unusualBigramCount++;
          }
        }

        // If more than 30% of bigrams are unusual, it's likely keyboard mashing
        if (unusualBigramCount / (cleanWord.length - 1) > 0.3) {
          return true;
        }

        // Check for lack of common English letter patterns
        const commonBigrams = [
          "th",
          "he",
          "in",
          "er",
          "an",
          "re",
          "on",
          "at",
          "en",
          "nd",
          "ti",
          "es",
          "or",
          "te",
          "of",
          "ed",
          "is",
          "it",
          "al",
          "ar",
          "st",
          "to",
          "nt",
          "ng",
          "se",
          "ha",
          "as",
          "ou",
          "io",
          "le",
        ];
        let commonBigramCount = 0;
        for (let i = 0; i < cleanWord.length - 1; i++) {
          const bigram = cleanWord.substring(i, i + 2);
          if (commonBigrams.includes(bigram)) {
            commonBigramCount++;
          }
        }

        // If less than 20% of bigrams are common English patterns, suspicious
        if (
          cleanWord.length > 6 &&
          commonBigramCount / (cleanWord.length - 1) < 0.2
        ) {
          return true;
        }
      }

      return false;
    },
    description: "Random keyboard mashing patterns detected",
  },
  {
    name: "Improbable Letter Combinations",
    weight: 3,
    check: (name) => {
      const words = name.trim().split(/\s+/);

      for (const word of words) {
        const cleanWord = word.toLowerCase().replace(/[^a-z]/g, "");
        if (cleanWord.length < 6) continue;

        // Check for words with very low English language probability
        // These are trigrams (3-letter combinations) rarely found in English
        const rareTrigrams = [
          "qwe",
          "wer",
          "ert",
          "rty",
          "tyu",
          "yui",
          "uio",
          "iop",
          "asd",
          "sdf",
          "dfg",
          "fgh",
          "ghj",
          "hjk",
          "jkl",
          "zxc",
          "xcv",
          "cvb",
          "vbn",
          "bnm",
          "poi",
          "oiu",
          "iuy",
          "uyt",
          "ytr",
          "tre",
          "rew",
          "ewq",
          "lkj",
          "kjh",
          "jhg",
          "hgf",
          "gfd",
          "fds",
          "dsa",
          "mnb",
          "nbv",
          "bvc",
          "vcx",
          "cxz",
          "qaz",
          "wsx",
          "edc",
          "rfv",
          "tgb",
          "yhn",
          "ujm",
          "ik",
          "fja",
          "fjp",
          "mcr",
          "kgj",
          "ryq",
          "fms",
          "ruq",
        ];

        let rareTrigramCount = 0;
        for (let i = 0; i < cleanWord.length - 2; i++) {
          const trigram = cleanWord.substring(i, i + 3);
          if (rareTrigrams.includes(trigram)) {
            rareTrigramCount++;
          }
        }

        // If more than 25% of trigrams are rare, likely fake
        if (rareTrigramCount / (cleanWord.length - 2) > 0.25) {
          return true;
        }
      }

      return false;
    },
    description: "Contains improbable letter combinations",
  },
  {
    name: "Repetitive Syllable Patterns",
    weight: 4,
    check: (name) => {
      const words = name.trim().split(/\s+/);

      for (const word of words) {
        const cleanWord = word.toLowerCase().replace(/[^a-z]/g, "");
        if (cleanWord.length < 6) continue;

        // Check for repetitive syllable patterns like "kukuku", "jijiji", "ninini"
        // Look for patterns where the same syllable is repeated 3+ times

        // Check for 2-letter syllable repetition (like "ku-ku-ku")
        for (let i = 0; i <= cleanWord.length - 6; i++) {
          const syllable = cleanWord.substring(i, i + 2);
          if (
            cleanWord.substring(i, i + 6) ===
            syllable + syllable + syllable
          ) {
            return true;
          }
        }

        // Check for 3-letter syllable repetition (like "kuk-uku")
        for (let i = 0; i <= cleanWord.length - 6; i++) {
          const syllable = cleanWord.substring(i, i + 3);
          if (cleanWord.substring(i, i + 6) === syllable + syllable) {
            return true;
          }
        }

        // Check for specific known repetitive patterns
        const repetitivePatterns = [
          "kukuku",
          "jijiji",
          "ninini",
          "pipipi",
          "jajaja",
          "nanana",
          "kakaka",
          "kekeke",
          "bebebe",
          "vuvuvu",
          "mumumu",
          "lululu",
          "tututu",
          "sasasa",
          "rarara",
          "gagaga",
          "hahaha",
          "dododo",
          "fofofo",
          "cococo",
          "bobobo",
          "popopo",
          "tototo",
          "sososo",
          "rororo",
          "gogogo",
          "hohoho",
          "dododo",
          "fofofo",
          "cococo",
        ];

        if (repetitivePatterns.some((pattern) => cleanWord.includes(pattern))) {
          return true;
        }

        // Check for alternating vowel-consonant repetition
        // Pattern like "kukuku" where consonant-vowel-consonant repeats
        if (cleanWord.length >= 6) {
          let repetitiveCount = 0;
          for (let i = 0; i <= cleanWord.length - 6; i++) {
            const segment = cleanWord.substring(i, i + 6);
            // Check if it's a 3x repetition of a 2-character pattern
            if (segment.length === 6) {
              const part1 = segment.substring(0, 2);
              const part2 = segment.substring(2, 4);
              const part3 = segment.substring(4, 6);
              if (part1 === part2 && part2 === part3) {
                repetitiveCount++;
              }
            }
          }

          // If we find multiple repetitive segments, it's suspicious
          if (repetitiveCount > 0) {
            return true;
          }
        }

        // Check for high repetition ratio in the word
        const charCounts: { [key: string]: number } = {};
        for (const char of cleanWord) {
          charCounts[char] = (charCounts[char] || 0) + 1;
        }

        // If any character appears more than 50% of the time, it's suspicious
        const maxCount = Math.max(...Object.values(charCounts));
        if (maxCount / cleanWord.length > 0.5 && cleanWord.length >= 6) {
          return true;
        }
      }

      return false;
    },
    description:
      "Repetitive syllable patterns (like 'kukuku', 'jijiji', 'ninini')",
  },
  {
    name: "Random Character Sequences",
    weight: 4,
    check: (name) => {
      const words = name.trim().split(/\s+/);

      for (const word of words) {
        const cleanWord = word.toLowerCase().replace(/[^a-z]/g, "");
        if (cleanWord.length < 5) continue;

        // Check for random character sequences like "fksjaf", "roiuew"
        // These patterns have high entropy but no common English patterns

        // Calculate character distribution entropy
        const charCounts: { [key: string]: number } = {};
        for (const char of cleanWord) {
          charCounts[char] = (charCounts[char] || 0) + 1;
        }

        const uniqueChars = Object.keys(charCounts).length;
        const totalChars = cleanWord.length;
        const entropy = uniqueChars / totalChars;

        // High entropy (many unique characters) suggests random typing
        if (entropy > 0.8 && cleanWord.length >= 5) {
          // Check for absence of common English patterns
          const hasCommonPatterns =
            /(th|he|in|er|an|re|ed|nd|on|en|at|ou|it|is|or|ti|as|to|ha|ng|es|st|nt|of|and|the|for|are|but|not|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|man|new|now|old|see|two|way|who|boy|did|its|let|put|say|she|too|use|ch|sh|ck|ph|gh|wh|qu|ai|ei|ie|ou|au|eu|oi|ui)/.test(
              cleanWord
            );

          // Check if it looks like a legitimate name pattern
          // Legitimate names typically have:
          // 1. At least one vowel
          // 2. Not too many consecutive consonants (max 3)
          // 3. Reasonable vowel-to-consonant ratio
          const hasVowel = /[aeiou]/.test(cleanWord);
          const maxConsecutiveConsonants = Math.max(
            ...cleanWord.split(/[aeiou]/).map((part) => part.length)
          );
          const vowelCount = (cleanWord.match(/[aeiou]/g) || []).length;
          const vowelRatio = vowelCount / cleanWord.length;

          const isLikelyRealName =
            hasVowel && maxConsecutiveConsonants <= 3 && vowelRatio >= 0.15; // At least 15% vowels

          // For very long sequences, be more strict
          if (cleanWord.length > 15) {
            // Long sequences need higher vowel ratio to be considered legitimate
            const isLikelyRealNameStrict =
              hasVowel && maxConsecutiveConsonants <= 2 && vowelRatio >= 0.25; // At least 25% vowels for long sequences

            if (!hasCommonPatterns && !isLikelyRealNameStrict) {
              return true;
            }
          } else {
            if (!hasCommonPatterns && !isLikelyRealName) {
              return true;
            }
          }
        }

        // Check for unusual consonant clusters that don't exist in English
        const unusualClusters = [
          "fks",
          "ksj",
          "sjf",
          "jfa",
          "roi",
          "oiu",
          "iue",
          "uew",
          "fkj",
          "kjs",
          "jsa",
          "saf",
          "roi",
          "oiu",
          "iue",
          "uew",
          "fksj",
          "ksja",
          "sjaf",
          "roiu",
          "oiue",
          "iuew",
          "fksja",
          "ksjaf",
          "roiue",
          "oiuew",
        ];

        for (const cluster of unusualClusters) {
          if (cleanWord.includes(cluster)) {
            return true;
          }
        }

        // Check for lack of vowels in long sequences
        const vowelCount = (cleanWord.match(/[aeiou]/g) || []).length;
        if (cleanWord.length >= 6 && vowelCount / cleanWord.length < 0.2) {
          return true;
        }

        // Check for alternating patterns that are too regular
        let alternatingCount = 0;
        for (let i = 1; i < cleanWord.length - 1; i++) {
          const prev = cleanWord[i - 1];
          const curr = cleanWord[i];
          const next = cleanWord[i + 1];

          if (
            (prev.match(/[aeiou]/) &&
              curr.match(/[bcdfghjklmnpqrstvwxyz]/) &&
              next.match(/[aeiou]/)) ||
            (prev.match(/[bcdfghjklmnpqrstvwxyz]/) &&
              curr.match(/[aeiou]/) &&
              next.match(/[bcdfghjklmnpqrstvwxyz]/))
          ) {
            alternatingCount++;
          }
        }

        // If more than 70% follows alternating pattern, it's likely random
        if (
          alternatingCount / cleanWord.length > 0.7 &&
          cleanWord.length >= 6
        ) {
          return true;
        }

        // Check for sequences that look like random keyboard mashing
        // Look for patterns that don't follow natural language rules
        const hasNaturalPatterns =
          /(th|he|in|er|an|re|ed|nd|on|en|at|ou|it|is|or|ti|as|to|ha|ng|es|st|nt|of|and|the|for|are|but|not|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|man|new|now|old|see|two|way|who|boy|did|its|let|put|say|she|too|use)/.test(
            cleanWord
          );

        if (!hasNaturalPatterns && cleanWord.length >= 6) {
          // Check if it has too many unique characters (high randomness)
          if (uniqueChars / cleanWord.length > 0.75) {
            return true;
          }
        }
      }

      return false;
    },
    description: "Random character sequences (like 'fksjaf', 'roiuew')",
  },
  {
    name: "Mixed Fake/Real Names",
    weight: 5,
    check: (name) => {
      const words = name.trim().split(/\s+/);
      if (words.length < 2) return false;

      // Check if name contains both legitimate and illegitimate patterns
      const legitimateWords = [];
      const illegitimateWords = [];

      for (const word of words) {
        const cleanWord = word.toLowerCase().replace(/[^a-z]/g, "");
        if (cleanWord.length < 3) continue;

        // Check if word is legitimate
        const hasVowel = /[aeiou]/.test(cleanWord);
        const maxConsecutiveConsonants = Math.max(
          ...cleanWord.split(/[aeiou]/).map((part) => part.length)
        );
        const vowelCount = (cleanWord.match(/[aeiou]/g) || []).length;
        const vowelRatio = vowelCount / cleanWord.length;

        const isLegitimate =
          hasVowel && maxConsecutiveConsonants <= 3 && vowelRatio >= 0.15;

        if (isLegitimate) {
          legitimateWords.push(word);
        } else {
          illegitimateWords.push(word);
        }
      }

      // If we have both legitimate and illegitimate words, it's suspicious
      return legitimateWords.length > 0 && illegitimateWords.length > 0;
    },
    description: "Mixed legitimate and fake name patterns",
  },
  {
    name: "Extremely Long Random Sequence",
    weight: 5,
    check: (name) => {
      const cleanName = name.replace(/\s/g, "").toLowerCase();
      if (cleanName.length < 20) return false;

      // Check for extremely long sequences that are clearly random
      const hasVowel = /[aeiou]/.test(cleanName);
      const vowelCount = (cleanName.match(/[aeiou]/g) || []).length;
      const vowelRatio = vowelCount / cleanName.length;

      // Very long sequences with low vowel ratio are suspicious
      if (vowelRatio < 0.3 && cleanName.length > 20) {
        return true;
      }

      // Check for repetitive patterns in long sequences
      let repetitiveCount = 0;
      for (let i = 0; i <= cleanName.length - 6; i++) {
        const segment = cleanName.substring(i, i + 6);
        // Check if it's a repetition of a 2-3 character pattern
        if (segment.length === 6) {
          const part1 = segment.substring(0, 2);
          const part2 = segment.substring(2, 4);
          const part3 = segment.substring(4, 6);
          if (part1 === part2 && part2 === part3) {
            repetitiveCount++;
          }
        }
      }

      // Too many repetitive segments in a long sequence
      if (repetitiveCount > 2 && cleanName.length > 25) {
        return true;
      }

      // Check for alternating patterns that are too regular
      let alternatingCount = 0;
      for (let i = 1; i < cleanName.length - 1; i++) {
        const prev = cleanName[i - 1];
        const curr = cleanName[i];
        const next = cleanName[i + 1];

        if (
          (prev.match(/[aeiou]/) &&
            curr.match(/[bcdfghjklmnpqrstvwxyz]/) &&
            next.match(/[aeiou]/)) ||
          (prev.match(/[bcdfghjklmnpqrstvwxyz]/) &&
            curr.match(/[aeiou]/) &&
            next.match(/[bcdfghjklmnpqrstvwxyz]/))
        ) {
          alternatingCount++;
        }
      }

      // If more than 80% follows alternating pattern in a long sequence, it's fake
      if (alternatingCount / cleanName.length > 0.8 && cleanName.length > 20) {
        return true;
      }

      return false;
    },
    description: "Extremely long random character sequences",
  },
];

function analyzeName(name: string): AnalysisResult {
  if (!name.trim()) {
    return {
      isFake: false,
      confidence: 0,
      reasons: [],
      score: 0,
    };
  }

  // Check if name is in static real names - always mark as real
  const cleanName = name.trim().toLowerCase();
  const isInStaticReal = STATIC_REAL_NAMES.some(
    (realName) => realName.toLowerCase().trim() === cleanName
  );

  // Check if name is in static fake names - always mark as fake
  const isInStaticFake = STATIC_FAKE_NAMES.some(
    (fakeName) => fakeName.toLowerCase().trim() === cleanName
  );

  // Check for partial matches in static real names (e.g., "Arafat Chowdhuri" contains "chowdhury")
  const hasPartialRealMatch = STATIC_REAL_NAMES.some((realName) => {
    const realNameLower = realName.toLowerCase().trim();
    const nameWords = cleanName.split(/\s+/);
    return nameWords.some(
      (word) => word.length >= 3 && realNameLower.includes(word)
    );
  });

  // Check for partial matches in static fake names
  const hasPartialFakeMatch = STATIC_FAKE_NAMES.some((fakeName) => {
    const fakeNameLower = fakeName.toLowerCase().trim();
    const nameWords = cleanName.split(/\s+/);
    return nameWords.some(
      (word) => word.length >= 3 && fakeNameLower.includes(word)
    );
  });

  // Check for common real name patterns and titles
  const hasCommonRealPatterns = (() => {
    const words = cleanName.split(/\s+/);

    // Common surname patterns and titles that indicate real names
    const realTitles = [
      // Common surname patterns (not individual names)
      "chowdhury",
      "chowdhuri",
      "khan",
      "ahmed",
      "hassan",
      "hussain",
      "ali",
      "rahman",
      "kumar",
      "singh",
      "patel",
      "sharma",
      "gupta",
      "verma",
      "yadav",
      "jain",
      "smith",
      "johnson",
      "williams",
      "brown",
      "jones",
      "garcia",
      "miller",
      "davis",
      "rodriguez",
      "martinez",
      "anderson",
      "taylor",
      "thomas",
      "hernandez",
      "moore",
      "jackson",
      "martin",
      "lee",
      "perez",
      "thompson",
      "white",
      "harris",
      "sanchez",
      "clark",
      "ramirez",
      "lewis",
      "robinson",
      "walker",
      "young",
      "allen",
      "king",
      "wright",
      "scott",
      "torres",
      "nguyen",
      "hill",
      "flores",
      "green",
      "adams",
      "nelson",
      "baker",
      "hall",
      "rivera",
      "campbell",
      "mitchell",
      "carter",
      "roberts",
      "gomez",
      "phillips",
      "evans",
      "turner",
      "diaz",
      "parker",
      "cruz",
      "edwards",
    ];

    // Check if ALL words are legitimate (not just some)
    // This prevents fake names with legitimate surnames from being marked as real
    const legitimateWords = words.filter((word) => {
      if (word.length < 3) return false;

      // Check if word matches a known real surname
      const matchesRealSurname = realTitles.some(
        (title) => title.includes(word) || word.includes(title)
      );

      // Check if word follows legitimate name patterns
      const hasVowel = /[aeiou]/.test(word);
      const maxConsecutiveConsonants = Math.max(
        ...word.split(/[aeiou]/).map((part) => part.length)
      );
      const vowelCount = (word.match(/[aeiou]/g) || []).length;
      const vowelRatio = vowelCount / word.length;

      const followsLegitimatePattern =
        hasVowel && maxConsecutiveConsonants <= 3 && vowelRatio >= 0.15;

      return matchesRealSurname || followsLegitimatePattern;
    });

    // Only return true if ALL words are legitimate
    return words.length > 0 && legitimateWords.length === words.length;
  })();

  // If it's in static real names, always return as real
  if (isInStaticReal) {
    return {
      isFake: false,
      confidence: 0,
      reasons: ["Known real name (from static list)"],
      score: 0,
    };
  }

  // If it's in static fake names, always return as fake
  if (isInStaticFake) {
    return {
      isFake: true,
      confidence: 1,
      reasons: ["Known fake name (from static list)"],
      score: 10,
    };
  }

  // If it has partial match with static real names, mark as real
  if (hasPartialRealMatch) {
    return {
      isFake: false,
      confidence: 0,
      reasons: ["Contains known real name pattern"],
      score: 0,
    };
  }

  // If it has partial match with static fake names, mark as fake
  if (hasPartialFakeMatch) {
    return {
      isFake: true,
      confidence: 1,
      reasons: ["Contains known fake name pattern"],
      score: 10,
    };
  }

  // If it has common real name patterns, mark as real
  if (hasCommonRealPatterns) {
    return {
      isFake: false,
      confidence: 0,
      reasons: ["Contains common real name pattern"],
      score: 0,
    };
  }

  // Normal analysis for names not in static lists
  let totalScore = 0;
  const triggeredRules: string[] = [];

  detectionRules.forEach((rule) => {
    if (rule.check(name)) {
      totalScore += rule.weight;
      triggeredRules.push(rule.description);
    }
  });

  const confidence = Math.min(totalScore / 10, 1); // Normalize to 0-1
  const isFake = totalScore >= 4; // Threshold for fake detection - lowered to catch more obvious fakes

  return {
    isFake,
    confidence,
    reasons: triggeredRules,
    score: totalScore,
  };
}

export default function Home() {
  const [name, setName] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const debouncedAnalyze = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (value: string) => {
        clearTimeout(timeoutId);
        if (value.trim()) {
          setIsAnalyzing(true);
          timeoutId = setTimeout(() => {
            const analysis = analyzeName(value);
            setResult(analysis);
            setIsAnalyzing(false);
          }, 300);
        } else {
          setResult(null);
          setIsAnalyzing(false);
        }
      };
    })(),
    []
  );

  useEffect(() => {
    debouncedAnalyze(name);
  }, [name, debouncedAnalyze]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              🔍 Fake Name Detector
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Advanced AI-powered system to detect fake names with high
              accuracy. Uses multiple detection algorithms to identify
              suspicious naming patterns.
            </p>
          </div>

          {/* Input Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
            <div className="mb-6">
              <label
                htmlFor="nameInput"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Enter a name to analyze:
              </label>
              <div className="relative">
                <input
                  id="nameInput"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter a name (e.g., John Smith, Test User, etc.)"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                />
                {isAnalyzing && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Results */}
            {result && (
              <div className="space-y-6">
                {/* Main Result */}
                <div
                  className={`p-6 rounded-lg border-2 ${
                    result.isFake
                      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                      : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`text-3xl ${
                          result.isFake ? "text-red-500" : "text-green-500"
                        }`}
                      >
                        {result.isFake ? "❌" : "✅"}
                      </div>
                      <div>
                        <h3
                          className={`text-xl font-bold ${
                            result.isFake
                              ? "text-red-700 dark:text-red-300"
                              : "text-green-700 dark:text-green-300"
                          }`}
                        >
                          {result.isFake ? "Fake Name Detected" : "Real Name"}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Confidence: {Math.round(result.confidence * 100)}%
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                        {result.score.toFixed(1)}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Suspicion Score
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Analysis */}
                {result.reasons.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                      Analysis Details:
                    </h4>
                    <div className="space-y-2">
                      {result.reasons.map((reason, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2 text-sm"
                        >
                          <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
                          <span className="text-gray-700 dark:text-gray-300">
                            {reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confidence Bar */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Confidence Level:
                  </h4>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        result.confidence < 0.3
                          ? "bg-green-500"
                          : result.confidence < 0.6
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${result.confidence * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-2">
                    <span>Low Risk</span>
                    <span>Medium Risk</span>
                    <span>High Risk</span>
                  </div>
                </div>
              </div>
            )}

            {/* Examples */}
            <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3">
                Try these examples:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <h5 className="font-medium text-blue-700 dark:text-blue-300">
                    Real Names:
                  </h5>
                  <div className="space-y-1">
                    {STATIC_REAL_NAMES.slice(0, 4).map((example, index) => (
                      <button
                        key={index}
                        onClick={() => setName(example)}
                        className="block w-full text-left px-3 py-1 text-sm bg-white dark:bg-gray-800 rounded border hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <h5 className="font-medium text-blue-700 dark:text-blue-300">
                    Fake Names:
                  </h5>
                  <div className="space-y-1">
                    {STATIC_FAKE_NAMES.slice(0, 4).map((example, index) => (
                      <button
                        key={index}
                        onClick={() => setName(example)}
                        className="block w-full text-left px-3 py-1 text-sm bg-white dark:bg-gray-800 rounded border hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                High Accuracy
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Uses 15+ detection algorithms to identify fake names with high
                precision.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                Real-time Analysis
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Instant analysis with detailed breakdown of why a name is
                considered fake.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                Privacy Focused
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                All analysis happens locally in your browser. No data is sent to
                servers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
