import ExcelJS from 'exceljs';
import { mn } from '@/locales/mn';

// The empty class-list file a teacher downloads, fills in and uploads again.
export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(mn.importPage.templateSheet, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: '№', width: 6 },
    { header: mn.students.familyInitial, width: 22 },
    { header: mn.students.firstName, width: 26 },
    { header: mn.students.gender, width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow([1, 'Б', 'Тэмүүлэн', mn.students.male]);
  sheet.addRow([2, 'Д', 'Номин', mn.students.female]);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as unknown as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="class-list.xlsx"; filename*=UTF-8''${encodeURIComponent(mn.importPage.templateFile)}`,
      'Cache-Control': 'no-store',
    },
  });
}
