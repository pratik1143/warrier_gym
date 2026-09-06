import { Router } from 'express';
import {
  getEnquiries,
  getEnquiryHistory,
  createEnquiry,
  updateEnquiry,
  deleteEnquiry,
  convertEnquiryToMember,
  importEnquiriesExcel,
  parseEnquiryPdf
} from '../controllers/enquiry.controller';

const router = Router();

router.get('/', getEnquiries);
router.get('/:id/history', getEnquiryHistory);
router.post('/import-excel', importEnquiriesExcel);
router.post('/', createEnquiry);
router.put('/:id', updateEnquiry);
router.delete('/:id', deleteEnquiry);
router.post('/:id/convert', convertEnquiryToMember);
router.post('/parse-pdf', parseEnquiryPdf);

export default router;
