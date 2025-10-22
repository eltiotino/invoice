
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// La interfaz de la factura sigue siendo útil para la seguridad de tipos
export interface Invoice {
  id: string;
  number: string;
  year: number;
  tenant: { name: string; dni: string; address: string; };
  invoiceDate: string;
  invoiceNumber?: string; // Número de factura en formato AA/MM (opcional en la interfaz ya que lo proporcionamos en el body)
  items: { description: string; quantity: number; price: number; }[];
  subtotal: number;
  iva: number;
  irpf: number;
  total: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Omit<Invoice, 'id' | 'number' | 'year' | 'subtotal' | 'iva' | 'irpf' | 'total'>;
    const { tenant, invoiceDate, invoiceNumber, items } = body;

    // --- Usar el número de factura proporcionado manualmente ---
    const newInvoiceNumber = invoiceNumber; // Número de factura en formato AA/MM proporcionado por el usuario
    const currentYear = new Date().getFullYear();
    const newInvoiceId = `${currentYear}-${newInvoiceNumber}`;

    // --- Los cálculos no cambian ---
    const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    const iva = subtotal * 0.21;
    const irpf = subtotal * 0.19;
    const total = subtotal + iva - irpf;

    // --- NO HAY INTERACCIÓN CON BASE DE DATOS ---

    // --- La generación del PDF no cambia ---
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
    page.drawText('Valentín Morala Aparicio', { x: xStart, y: yPos, font: helveticaFont, size: bodyFontSize });
    yPos -= lineHeight;
    page.drawText('DNI: 34445836R', { x: xStart, y: yPos, font: helveticaFont, size: bodyFontSize });
    yPos -= lineHeight;
    page.drawText('Representante Legal: Sofía Morala Morena', { x: xStart, y: yPos, font: helveticaFont, size: bodyFontSize });
    yPos -= lineHeight;
    page.drawText('DNI Representante Legal: 02875027G', { x: xStart, y: yPos, font: helveticaFont, size: bodyFontSize });
    yPos -= lineHeight;
    page.drawText('Ribadavia 31 4 1 28029 Madrid', { x: xStart, y: yPos, font: helveticaFont, size: bodyFontSize });
    yPos -= lineHeight;
    page.drawText('Teléfono: 629 914 548', { x: xStart, y: yPos, font: helveticaFont, size: bodyFontSize });

    yPos = yStart - (lineHeight * 3);
    page.drawText('CLIENTE (ARRENDATARIO):', { x: xStart + 300, y: yPos, font: helveticaBoldFont, size: headingFontSize });
    yPos -= lineHeight;
    page.drawText(tenant.name, { x: xStart + 300, y: yPos, font: helveticaFont, size: bodyFontSize });
    yPos -= lineHeight;
    page.drawText(`DNI: ${tenant.dni}`, { x: xStart + 300, y: yPos, font: helveticaFont, size: bodyFontSize });
    yPos -= lineHeight;
    page.drawText(tenant.address, { x: xStart + 300, y: yPos, font: helveticaFont, size: bodyFontSize });

    yPos -= (lineHeight * 5); // Move table further down the page
    const tableTop = yPos;
    page.drawText('Descripción', { x: xStart, y: tableTop, font: helveticaBoldFont, size: headingFontSize });
    const totalTextWidth = helveticaBoldFont.widthOfTextAtSize('Total', headingFontSize);
    page.drawText('Total', { x: width - margin - totalTextWidth, y: tableTop, font: helveticaBoldFont, size: headingFontSize });
    
    yPos = tableTop - 5;
    page.drawLine({ start: { x: margin, y: yPos }, end: { x: width - margin, y: yPos }, thickness: 1 });

    yPos -= lineHeight;
    items.forEach(item => {
      const itemTotal = item.quantity * item.price;
      // Check if description contains newline characters and handle accordingly
      if (item.description.includes('\\n') || item.description.includes('\n')) {
        // Split the description by newlines and draw each line
        const descriptionLines = item.description.split(/\\n|\n/);
        descriptionLines.forEach((line, index) => {
          page.drawText(line.trim(), { x: xStart, y: yPos, font: helveticaFont, size: bodyFontSize });
          yPos -= lineHeight;
        });
        // Draw the total amount on the same y position as the last line of the description
        const itemTotalText = `${itemTotal.toFixed(2)} €`;
        const itemTotalWidth = helveticaFont.widthOfTextAtSize(itemTotalText, bodyFontSize);
        page.drawText(itemTotalText, { x: width - margin - itemTotalWidth, y: yPos + (lineHeight * descriptionLines.length) - lineHeight, font: helveticaFont, size: bodyFontSize });
      } else {
        // Original behavior for single line descriptions
        page.drawText(item.description, { x: xStart, y: yPos, font: helveticaFont, size: bodyFontSize });
        const itemTotalText = `${itemTotal.toFixed(2)} €`;
        const itemTotalWidth = helveticaFont.widthOfTextAtSize(itemTotalText, bodyFontSize);
        page.drawText(itemTotalText, { x: width - margin - itemTotalWidth, y: yPos, font: helveticaFont, size: bodyFontSize });
        yPos -= lineHeight * 1.5; // Increased line height to provide more space between items for multiline descriptions
      }
    });

    // --- SUMMARY BLOCK MOVED TO BOTTOM ---
    // Se resetea la posición Y a un valor fijo cerca del final de la página
    yPos = 180; // Puedes ajustar este valor para mover el bloque más arriba o abajo
    const summaryX = width - margin - 200;

    page.drawLine({ start: { x: summaryX, y: yPos }, end: { x: width - margin, y: yPos }, thickness: 0.5 });
    yPos -= lineHeight;

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

    yPos -= (lineHeight * 1.5); // Espacio extra antes del total
    page.drawText('TOTAL FACTURA:', { x: summaryX, y: yPos, font: helveticaBoldFont, size: headingFontSize });
    const totalAmountText = `${total.toFixed(2)} €`;
    const totalAmountWidth = helveticaBoldFont.widthOfTextAtSize(totalAmountText, headingFontSize);
    page.drawText(totalAmountText, { x: width - margin - totalAmountWidth, y: yPos, font: helveticaBoldFont, size: headingFontSize });

    // Add payment information at the bottom of the invoice
    yPos -= (lineHeight * 3); // Move down below the total
    page.drawText('Forma de Pago: Transferencia bancaria a la cuenta ES50 0049 3102 9726 9404 6635', { 
      x: xStart, 
      y: yPos, 
      font: helveticaFont, 
      size: bodyFontSize 
    });

    const pdfBytes = await pdfDoc.save();

    // --- FILENAME MADE UNIQUE ---
    const uniqueFilename = `factura-${newInvoiceId}-${Date.now()}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${uniqueFilename}"`,
      },
    });

  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido al generar la factura.';
    return new NextResponse(JSON.stringify({ error: errorMessage }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
