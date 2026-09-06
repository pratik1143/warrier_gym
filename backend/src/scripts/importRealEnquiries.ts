import { importEnquiriesFromExcel } from '../services/enquiryImport.service';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('===============================================================');
  console.log('  WARRIOR GYM OS — PRODUCTION REAL ENQUIRY EXCEL IMPORT');
  console.log('===============================================================\n');

  const defaultPath = 'C:\\Users\\HP CONNECT\\Downloads\\inquiries 230826.xlsx';
  const customPath = process.argv[2];
  const targetFile = customPath || defaultPath;

  if (!fs.existsSync(targetFile)) {
    console.error(`❌ File not found at: ${targetFile}`);
    process.exit(1);
  }

  console.log(`Reading Excel file from: ${targetFile}`);
  const startTime = Date.now();

  try {
    const report = await importEnquiriesFromExcel(targetFile);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n===============================================================');
    console.log('  IMPORT REPORT');
    console.log('===============================================================');
    console.log(`  Total Rows in Sheet 1:        ${report.totalRows}`);
    console.log(`  Master Enquiries Imported:    ${report.imported}`);
    console.log(`  - Pending Enquiries:          ${report.pending}`);
    console.log(`  - Closed Enquiries:           ${report.closed}`);
    console.log(`  Duplicates Prevented:         ${report.duplicatesPrevented}`);
    console.log(`  Invalid Rows:                 ${report.invalid}`);
    console.log(`  Sheet 2 Closed Records Linked:${report.historicalRecordsLinked}`);
    console.log(`  Follow-ups Generated:         ${report.followupsGenerated}`);
    console.log(`  Completed in:                 ${duration}s`);
    console.log('===============================================================\n');

    if (report.errors.length > 0) {
      console.warn('Errors encountered:');
      report.errors.forEach(e => console.warn(`- Row ${e.row} (${e.name}): ${e.reason}`));
    }

    process.exit(0);
  } catch (err: any) {
    console.error('❌ Import failed with error:', err);
    process.exit(1);
  }
}

main();
