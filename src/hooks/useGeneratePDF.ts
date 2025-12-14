import { useCallback } from 'react';
import jsPDF from 'jspdf';
import { useCompanySettings } from './useCompanySettings';
import { getProductDisplayName } from '@/lib/utils';

export interface PDFDocumentData {
  type: 'order' | 'quote';
  number: string;
  date: string;
  validUntil?: string;
  contact: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    cpfCnpj?: string;
  };
  items: Array<{
    name: string;
    variation?: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
  discount?: number;
  shipping?: number;
  total: number;
  paymentMethod?: string;
  installments?: number;
  notes?: string;
  sellerName?: string;
  paymentCondition?: string;
  paymentSchedule?: Array<{
    type: string;
    label: string;
    amount: number;
    date: string | null;
    number?: number;
  }>;
}

export function useGeneratePDF() {
  const { data: companySettings } = useCompanySettings();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Helper to load image from URL
  const loadImage = (url: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      if (!url) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const generatePDF = useCallback(async (data: PDFDocumentData): Promise<Blob> => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = margin;

    // Colors
    const primaryColor: [number, number, number] = [75, 85, 99]; // Gray-600
    const headerBg: [number, number, number] = [249, 250, 251]; // Gray-50
    const accentColor: [number, number, number] = [79, 70, 229]; // Indigo-600

    // Load company logo
    const logoImg = await loadImage(companySettings?.logo_url || '');

    // ==================== HEADER ====================
    // Header background
    doc.setFillColor(...headerBg);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Logo on the left
    const logoWidth = 30;
    const logoHeight = 30;
    if (logoImg) {
      try {
        doc.addImage(logoImg, 'PNG', margin, 8, logoWidth, logoHeight);
      } catch (e) {
        // If image fails, show placeholder
        doc.setFillColor(229, 231, 235);
        doc.rect(margin, 8, logoWidth, logoHeight, 'F');
      }
    } else {
      // Placeholder for logo
      doc.setFillColor(229, 231, 235);
      doc.rect(margin, 8, logoWidth, logoHeight, 'F');
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text('LOGO', margin + logoWidth / 2, 8 + logoHeight / 2, { align: 'center' });
    }

    // Company info on the right side of header
    const companyX = margin + logoWidth + 10;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    const companyName = companySettings?.company_name || 'Empresa';
    doc.text(companyName, companyX, 14);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    let companyY = 19;
    
    if (companySettings?.address) {
      doc.text(companySettings.address, companyX, companyY);
      companyY += 4;
    }
    if (companySettings?.city && companySettings?.state) {
      const location = `${companySettings.city} - ${companySettings.state}${companySettings.zip_code ? ` - ${companySettings.zip_code}` : ''}`;
      doc.text(location, companyX, companyY);
      companyY += 4;
    }
    if (companySettings?.phone) {
      doc.text(`Tel: ${companySettings.phone}`, companyX, companyY);
      companyY += 4;
    }
    if (companySettings?.cnpj) {
      doc.text(`CNPJ: ${companySettings.cnpj}`, companyX, companyY);
    }

    // Document number on the far right
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...accentColor);
    const docLabel = data.type === 'order' ? 'PEDIDO' : 'PROPOSTA';
    doc.text(`${docLabel} Nº`, pageWidth - margin, 14, { align: 'right' });
    doc.setFontSize(18);
    doc.text(data.number, pageWidth - margin, 22, { align: 'right' });

    y = 52;

    // ==================== DATES BAR ====================
    doc.setFillColor(...accentColor);
    doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`Data: ${data.date}`, margin + 5, y + 6.5);
    if (data.validUntil) {
      doc.text(`Validade: ${data.validUntil}`, pageWidth - margin - 5, y + 6.5, { align: 'right' });
    }
    y += 16;

    // ==================== CLIENT INFO ====================
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('CLIENTE', margin, y);
    y += 6;

    // Client box
    doc.setDrawColor(156, 163, 175);
    doc.setLineWidth(0.5);
    const clientBoxY = y;
    doc.roundedRect(margin, y, pageWidth - 2 * margin, 22, 2, 2, 'S');
    
    y += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text(data.contact.name, margin + 4, y);
    y += 5;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    
    const contactInfo: string[] = [];
    if (data.contact.cpfCnpj) contactInfo.push(`CPF/CNPJ: ${data.contact.cpfCnpj}`);
    if (data.contact.phone) contactInfo.push(`Tel: ${data.contact.phone}`);
    if (data.contact.email) contactInfo.push(data.contact.email);
    
    if (contactInfo.length > 0) {
      doc.text(contactInfo.join('  •  '), margin + 4, y);
      y += 4;
    }
    
    if (data.contact.address) {
      doc.text(data.contact.address, margin + 4, y);
    }
    
    y = clientBoxY + 28;

    // ==================== NOTES/CONDITIONS ====================
    if (data.notes) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('OBSERVAÇÕES / CONDIÇÕES COMERCIAIS', margin, y);
      y += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(75, 85, 99);
      const notesLines = doc.splitTextToSize(data.notes, pageWidth - 2 * margin);
      doc.text(notesLines, margin, y);
      y += notesLines.length * 4 + 4;
    }

    // ==================== ITEMS TABLE ====================
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    const itemsLabel = data.type === 'order' ? 'ITENS DO PEDIDO' : 'ITENS DA PROPOSTA';
    doc.text(itemsLabel, margin, y);
    y += 6;

    // Table Header
    doc.setFillColor(229, 231, 235);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);
    y += 5;
    
    const colItem = margin + 4;
    const colSku = pageWidth - 100;
    const colQtd = pageWidth - 75;
    const colUnit = pageWidth - 50;
    const colSubtotal = pageWidth - margin - 4;
    
    doc.text('DESCRIÇÃO', colItem, y);
    doc.text('SKU', colSku, y, { align: 'center' });
    doc.text('QTD', colQtd, y, { align: 'center' });
    doc.text('UNIT.', colUnit, y, { align: 'right' });
    doc.text('SUBTOTAL', colSubtotal, y, { align: 'right' });
    y += 5;

    // Table Items
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    let totalItems = 0;
    let totalProducts = 0;
    
    data.items.forEach((item, index) => {
      if (y > 255) {
        doc.addPage();
        y = margin;
      }
      
      totalItems++;
      totalProducts += item.quantity;
      
      // Alternate row background
      if (index % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, y - 3, pageWidth - 2 * margin, 8, 'F');
      }
      
      const itemName = getProductDisplayName(item.name, item.variation, item.sku);
      const maxWidth = 70;
      const lines = doc.splitTextToSize(itemName, maxWidth);
      
      doc.setFontSize(9);
      doc.text(lines[0], colItem, y);
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(item.sku || '-', colSku, y, { align: 'center' });
      doc.setTextColor(55, 65, 81);
      doc.text(item.quantity.toString(), colQtd, y, { align: 'center' });
      doc.text(formatCurrency(item.unitPrice), colUnit, y, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(item.subtotal), colSubtotal, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      
      y += lines.length * 4 + 4;
    });

    y += 4;
    doc.setDrawColor(156, 163, 175);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // ==================== SUMMARY BOX ====================
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('RESUMO', margin, y);
    y += 6;

    // Summary table header
    doc.setFillColor(229, 231, 235);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    y += 5;
    
    const summaryWidth = (pageWidth - 2 * margin) / 6;
    doc.text('Nº ITENS', margin + summaryWidth * 0.5, y, { align: 'center' });
    doc.text('QTD PROD.', margin + summaryWidth * 1.5, y, { align: 'center' });
    doc.text('DESCONTO', margin + summaryWidth * 2.5, y, { align: 'center' });
    doc.text('SUBTOTAL', margin + summaryWidth * 3.5, y, { align: 'center' });
    doc.text('FRETE', margin + summaryWidth * 4.5, y, { align: 'center' });
    doc.text('TOTAL', margin + summaryWidth * 5.5, y, { align: 'center' });
    y += 6;

    // Summary values
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y - 3, pageWidth - 2 * margin, 10, 'F');
    doc.setDrawColor(156, 163, 175);
    doc.setLineWidth(0.5);
    doc.rect(margin, y - 3, pageWidth - 2 * margin, 10, 'S');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text(totalItems.toString(), margin + summaryWidth * 0.5, y + 2, { align: 'center' });
    doc.text(totalProducts.toString(), margin + summaryWidth * 1.5, y + 2, { align: 'center' });
    doc.setTextColor(16, 185, 129); // Green
    doc.text(data.discount ? `-${formatCurrency(data.discount)}` : 'R$ 0,00', margin + summaryWidth * 2.5, y + 2, { align: 'center' });
    doc.setTextColor(55, 65, 81);
    doc.text(formatCurrency(data.subtotal), margin + summaryWidth * 3.5, y + 2, { align: 'center' });
    doc.text(data.shipping ? formatCurrency(data.shipping) : 'R$ 0,00', margin + summaryWidth * 4.5, y + 2, { align: 'center' });
    doc.setTextColor(...accentColor);
    doc.setFontSize(10);
    doc.text(formatCurrency(data.total), margin + summaryWidth * 5.5, y + 2, { align: 'center' });
    
    y += 14;

    // ==================== PAYMENT INFO ====================
    if (data.paymentMethod || data.paymentSchedule) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('CONDIÇÕES DE PAGAMENTO', margin, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(75, 85, 99);
      
      const paymentMethodLabels: Record<string, string> = {
        'pix': 'PIX',
        'credit_card': 'Cartão de Crédito',
        'debit_card': 'Cartão de Débito',
        'boleto': 'Boleto',
        'cash': 'Dinheiro',
        'transfer': 'Transferência',
      };

      if (data.paymentMethod) {
        const paymentLabel = paymentMethodLabels[data.paymentMethod] || data.paymentMethod;
        doc.text(`Forma: ${paymentLabel}`, margin, y);
        y += 4;
      }

      if (data.paymentCondition) {
        const conditionLabels: Record<string, string> = {
          'full': 'À Vista',
          'installments': 'Parcelado',
          'down_payment': 'Entrada + Parcelas',
        };
        doc.text(`Condição: ${conditionLabels[data.paymentCondition] || data.paymentCondition}`, margin, y);
        y += 5;
      }

      if (data.paymentSchedule && data.paymentSchedule.length > 0) {
        doc.setFontSize(8);
        data.paymentSchedule.forEach((payment) => {
          if (y > 270) {
            doc.addPage();
            y = margin;
          }
          const dateStr = payment.date ? ` — ${payment.date.split('-').reverse().join('/')}` : '';
          doc.text(`• ${payment.label}: ${formatCurrency(payment.amount)}${dateStr}`, margin + 2, y);
          y += 4;
        });
      } else if (data.installments && data.installments > 1) {
        doc.text(`Parcelas: ${data.installments}x de ${formatCurrency(data.total / data.installments)}`, margin, y);
        y += 4;
      }
      y += 4;
    }

    // ==================== SELLER ====================
    if (data.sellerName) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(`Atenciosamente,`, margin, y);
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(55, 65, 81);
      doc.text(data.sellerName, margin, y);
      y += 8;
    }

    // ==================== SIGNATURE AREA ====================
    if (data.type === 'quote') {
      y = Math.max(y + 5, 240);
      
      doc.setDrawColor(156, 163, 175);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(margin, y, pageWidth - margin, y);
      doc.setLineDashPattern([], 0);
      y += 8;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      
      doc.text('Data da Aprovação: ____/____/________', margin, y);
      doc.text(`Proposta Nº: ${data.number}`, pageWidth - margin, y, { align: 'right' });
      y += 6;
      
      doc.text('Assinatura: ________________________________________', margin, y);
      doc.text(`Valor Total: ${formatCurrency(data.total)}`, pageWidth - margin, y, { align: 'right' });
    }

    // ==================== FOOTER ====================
    const footerY = doc.internal.pageSize.getHeight() - 8;
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );

    return doc.output('blob');
  }, [companySettings]);

  const downloadPDF = useCallback(async (data: PDFDocumentData, filename: string) => {
    const blob = await generatePDF(data);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [generatePDF]);

  const printPDF = useCallback(async (data: PDFDocumentData) => {
    const blob = await generatePDF(data);
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url);
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }, [generatePDF]);

  return {
    generatePDF,
    downloadPDF,
    printPDF,
  };
}
