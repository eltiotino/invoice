import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { kv } from '@vercel/kv';

// The main data structure for an invoice
export interface Invoice { 
  id: string; // e.g., 2025-0001
  number: string; // e.g., 0001
  year: number;
  tenant: { name: string; dni: string; address: string; };
  invoiceDate: string;
  items: { description: string; quantity: number; price: number; }[];
  subtotal: number;
  iva: number;
  irpf: number;
  total: number;
}

// This function generates the next invoice number (e.g., 0001, 0002)
async function getNextInvoiceNumber(year: number): Promise<{ id: string, number: string }> {
    const counterKey = `invoice_counter_${year}`;
    const newNumber = await kv.incr(counterKey);
    const formattedNumber = newNumber.toString().padStart(4, '0');
    const id = `${year}-${formattedNumber}`;
    return { id, number: formattedNumber };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Omit<Invoice, 'id' | 'number' | 'year' | 'subtotal' | 'iva' | 'irpf' | 'total'>;
    const { tenant, invoiceDate, items } = body;

    const currentYear = new Date().getFullYear();
    const { id: newInvoiceId, number: newInvoiceNumber } = await getNextInvoiceNumber(currentYear);

    // --- Perform Calculations ---
    const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    const iva = subtotal * 0.21;
    const irpf = subtotal * 0.19;
    const total = subtotal + iva - irpf;

    // --- Create the full invoice object to save ---
    const newInvoice: Invoice = {
        id: newInvoiceId,
        number: newInvoiceNumber,
        year: currentYear,
        ...body,
        subtotal, iva, irpf, total
    };

    // --- Save the new invoice to the KV store ---
    await kv.set(`invoice:${newInvoiceId}`, newInvoice);

    // --- Generate PDF (same logic as before) ---
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 50, yStart = height - margin, xStart = margin, lineHeight = 18;
    const titleFontSize = 18, headingFontSize = 11, bodyFontSize = 10;

    page.drawText('FACTURA', { x: xStart, y: yStart, font: helveticaBoldFont, size: titleFontSize });
    page.drawText(`Factura Nº: ${newInvoiceNumber}`, { x: width - margin - 150, y: yStart, font: helveticaBoldFont, size: headingFontSize });
    page.drawText(`Fecha: ${invoiceDate}`, { x: width - margin - 150, y: yStart - lineHeight, font: helveticaFont, size: bodyFontSize });

    let yPos = yStart - (lineHeight * 3);
    page.drawText('EMISOR:', { x: xStart, y: yPos, font: helveticaBoldFont, size: headingFontSize });
    yPos -= lineHeight;
    page.drawText('Valentín Morala Aparico', { x: xStart, y: yPos, font: helveticaFont, size: bodyFontSize });
    yPos -= lineHeight;
    page.drawText('DNI: 38445836R', { x: xStart, y: yPos, font: helveticaFont, size: bodyFontSize });
    yPos -= lineHeight;
    page.drawText('Calle Ribadavia 31 4º 1, 28029 Madrid', { x: xStart, y: yPos, font: helveticaFont, size: bodyFontSize });

    yPos = yStart - (lineHeight * 3);
    page.drawText('CLIENTE (ARRENDATARIO):', { x: xStart + 300, y: yPos, font: helveticaBoldFont, size: headingFontSize });
    yPos -= lineHeight;
    page.drawText(tenant.name, { x: xStart + 300, y: yPos, font: helveticaFont, size: bodyFontSize });
    yPos -= lineHeight;
    page.drawText(`DNI: ${tenant.dni}`, { x: xStart + 300, y: yPos, font: helveticaFont, size: bodyFontSize });
    yPos -= lineHeight;
    page.drawText(tenant.address, { x: xStart + 300, y: yPos, font: helveticaFont, size: bodyFontSize });

    yPos -= (lineHeight * 3);
    const tableTop = yPos;
    page.drawText('Descripción', { x: xStart, y: tableTop, font: helveticaBoldFont, size: headingFontSize });
    const totalTextWidth = helveticaBoldFont.widthOfTextAtSize('Total', headingFontSize);
    page.drawText('Total', { x: width - margin - totalTextWidth, y: tableTop, font: helveticaBoldFont, size: headingFontSize });
    
    yPos = tableTop - 5;
    page.drawLine({ start: { x: margin, y: yPos }, end: { x: width - margin, y: yPos }, thickness: 1 });

    yPos -= lineHeight;
    items.forEach(item => {
      const itemTotal = item.quantity * item.price;
      page.drawText(item.description, { x: xStart, y: yPos, font: helveticaFont, size: bodyFontSize });
      const itemTotalText = `${itemTotal.toFixed(2)} €`;
      const itemTotalWidth = helveticaFont.widthOfTextAtSize(itemTotalText, bodyFontSize);
      page.drawText(itemTotalText, { x: width - margin - itemTotalWidth, y: yPos, font: helveticaFont, size: bodyFontSize });
      yPos -= lineHeight;
    });

    yPos -= lineHeight;
    page.drawLine({ start: { x: width - margin - 200, y: yPos }, end: { x: width - margin, y: yPos }, thickness: 0.5 });
    yPos -= lineHeight;

    const summaryX = width - margin - 200;

    page.drawText('Base Imponible:', { x: summaryX, y: yPos, font: helveticaFont, size: bodyFontSize });
    const subtotalText = `${subtotal.toFixed(2)} €`;
    const subtotalWidth = helveticaFont.widthOfTextAtSize(subtotalText, bodyFontSize);
    page.drawText(subtotalText, { x: width - margin - subtotalWidth, y: yPos, font: helveticaFont, size: bodyFontSize });
    
    yPos -= lineHeight;
    page.drawText('IVA (21%):', { x: summaryX, y: yPos, font: helveticaFont, size: bodyFontSize });
    const ivaText = `${iva.toFixed(2)} €`;
    const ivaWidth = helveticaFont.widthOfTextAtSize(ivaText, bodyFontSize);
    page.drawText(ivaText, { x: width - margin - ivaWidth, y: yPos, font: helveticaFont, size: bodyFontSize });

    yPos -= lineHeight;
    page.drawText('Retención IRPF (19%):', { x: summaryX, y: yPos, font: helveticaFont, size: bodyFontSize });
    const irpfText = `-${irpf.toFixed(2)} €`;
    const irpfWidth = helveticaFont.widthOfTextAtSize(irpfText, bodyFontSize);
    page.drawText(irpfText, { x: width - margin - irpfWidth, y: yPos, font: helveticaFont, size: bodyFontSize });

    yPos -= lineHeight;
    page.drawText('TOTAL FACTURA:', { x: summaryX, y: yPos, font: helveticaBoldFont, size: headingFontSize });
    const totalAmountText = `${total.toFixed(2)} €`;
    const totalAmountWidth = helveticaBoldFont.widthOfTextAtSize(totalAmountText, headingFontSize);
    page.drawText(totalAmountText, { x: width - margin - totalAmountWidth, y: yPos, font: helveticaBoldFont, size: headingFontSize });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="factura-${newInvoiceId}.pdf"`,
      },
    });

  } catch (error) {
    console.error(error);
    return new NextResponse('Error al generar la factura en PDF.', { status: 500 });
  }
}