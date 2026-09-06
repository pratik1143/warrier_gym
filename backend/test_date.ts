const parseCSVDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const cleaned = dateStr.trim();
  
  // Try split by '-'
  const partsDash = cleaned.split('-');
  if (partsDash.length === 3) {
    let day = partsDash[0].padStart(2, '0');
    let month = partsDash[1].padStart(2, '0');
    let year = partsDash[2];
    if (day.length === 4) {
      return `${day}-${month}-${year}`;
    }
    if (year.length === 4) {
      return `${year}-${month}-${day}`;
    }
  }

  // Try split by '/'
  const partsSlash = cleaned.split('/');
  if (partsSlash.length === 3) {
    let day = partsSlash[0].padStart(2, '0');
    let month = partsSlash[1].padStart(2, '0');
    let year = partsSlash[2];
    if (day.length === 4) {
      return `${day}-${month}-${year}`;
    }
    if (year.length === 4) {
      return `${year}-${month}-${day}`;
    }
  }

  // Fallback: try parsing directly
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return '';
};

console.log("21-11-2026 ->", parseCSVDate("21-11-2026"));
console.log("21-09-2026 ->", parseCSVDate("21-09-2026"));
console.log("20-09-2026 ->", parseCSVDate("20-09-2026"));
console.log("Empty ->", parseCSVDate(""));

export {};
