import { useCallback } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useCompanySettings } from './useCompanySettings';

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
  // Payment schedule fields
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

  const generatePDF = useCallback(async (data: PDFDocumentData): Promise<Blob> => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = margin;

    // Header - Company Name
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    const companyName = companySettings?.company_name || 'Empresa';
    doc.text(companyName, margin, y);
    y += 8;

    // Company Info
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (companySettings?.phone) {
      doc.text(`Tel: ${companySettings.phone}`, margin, y);
      y += 4;
    }
    if (companySettings?.email) {
      doc.text(`Email: ${companySettings.email}`, margin, y);
      y += 4;
    }
    if (companySettings?.address) {
      doc.text(companySettings.address, margin, y);
      y += 4;
    }
    if (companySettings?.cnpj) {
      doc.text(`CNPJ: ${companySettings.cnpj}`, margin, y);
      y += 4;
    }

    y += 6;

    // Document Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const title = data.type === 'order' ? `PEDIDO #${data.number}` : `ORÇAMENTO #${data.number}`;
    doc.text(title, pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data: ${data.date}`, margin, y);
    if (data.validUntil) {
      doc.text(`Validade: ${data.validUntil}`, pageWidth - margin, y, { align: 'right' });
    }
    y += 8;

    // Divider
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Client Info
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE', margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(data.contact.name, margin, y);
    y += 5;
    if (data.contact.phone) {
      doc.text(`Tel: ${data.contact.phone}`, margin, y);
      y += 5;
    }
    if (data.contact.email) {
      doc.text(`Email: ${data.contact.email}`, margin, y);
      y += 5;
    }
    if (data.contact.address) {
      doc.text(data.contact.address, margin, y);
      y += 5;
    }
    y += 5;

    // Items Header
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    y += 5;
    doc.text('ITEM', margin + 2, y);
    doc.text('QTD', pageWidth - 75, y, { align: 'right' });
    doc.text('UNIT.', pageWidth - 50, y, { align: 'right' });
    doc.text('SUBTOTAL', pageWidth - margin - 2, y, { align: 'right' });
    y += 6;

    // Items
    doc.setFont('helvetica', 'normal');
    data.items.forEach((item) => {
      if (y > 260) {
        doc.addPage();
        y = margin;
      }
      
      const itemName = item.variation ? `${item.name} - ${item.variation}` : item.name;
      const maxWidth = 80;
      const lines = doc.splitTextToSize(itemName, maxWidth);
      
      doc.text(lines, margin + 2, y);
      doc.text(item.quantity.toString(), pageWidth - 75, y, { align: 'right' });
      doc.text(formatCurrency(item.unitPrice), pageWidth - 50, y, { align: 'right' });
      doc.text(formatCurrency(item.subtotal), pageWidth - margin - 2, y, { align: 'right' });
      
      if (item.sku) {
        y += 4;
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`SKU: ${item.sku}`, margin + 2, y);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
      }
      
      y += lines.length * 4 + 3;
    });

    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Totals
    const totalsX = pageWidth - margin - 60;
    doc.setFontSize(10);
    
    doc.text('Subtotal:', totalsX, y);
    doc.text(formatCurrency(data.subtotal), pageWidth - margin, y, { align: 'right' });
    y += 5;

    if (data.discount && data.discount > 0) {
      doc.setTextColor(0, 128, 0);
      doc.text('Desconto:', totalsX, y);
      doc.text(`-${formatCurrency(data.discount)}`, pageWidth - margin, y, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += 5;
    }

    if (data.shipping && data.shipping > 0) {
      doc.text('Frete:', totalsX, y);
      doc.text(formatCurrency(data.shipping), pageWidth - margin, y, { align: 'right' });
      y += 5;
    }

    y += 2;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', totalsX, y);
    doc.text(formatCurrency(data.total), pageWidth - margin, y, { align: 'right' });
    y += 10;

    // Payment Method
    if (data.paymentMethod) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Map payment method to readable label
      const paymentMethodLabels: Record<string, string> = {
        'pix': 'PIX',
        'credit_card': 'Cartão de Crédito',
        'debit_card': 'Cartão de Débito',
        'boleto': 'Boleto',
        'cash': 'Dinheiro',
        'transfer': 'Transferência',
      };
      const paymentMethodLabel = paymentMethodLabels[data.paymentMethod] || data.paymentMethod;
      
      doc.text(`Forma de Pagamento: ${paymentMethodLabel}`, margin, y);
      y += 5;
      
      // Payment condition label
      if (data.paymentCondition) {
        const conditionLabels: Record<string, string> = {
          'full': 'À Vista',
          'installments': 'Parcelado',
          'down_payment': 'Entrada + Parcelas',
        };
        const conditionLabel = conditionLabels[data.paymentCondition] || data.paymentCondition;
        doc.text(`Condição: ${conditionLabel}`, margin, y);
        y += 5;
      }
      
      // Payment schedule with dates
      if (data.paymentSchedule && data.paymentSchedule.length > 0) {
        y += 3;
        doc.setFont('helvetica', 'bold');
        doc.text('Cronograma de Pagamentos:', margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        
        data.paymentSchedule.forEach((payment) => {
          if (y > 270) {
            doc.addPage();
            y = margin;
          }
          
          const dateStr = payment.date 
            ? ` — ${payment.date.split('-').reverse().join('/')}`
            : '';
          doc.text(`• ${payment.label}: ${formatCurrency(payment.amount)}${dateStr}`, margin + 2, y);
          y += 5;
        });
        y += 3;
      } else if (data.installments && data.installments > 1) {
        doc.text(`Parcelas: ${data.installments}x de ${formatCurrency(data.total / data.installments)}`, margin, y);
        y += 5;
      }
      y += 3;
    }

    // Notes
    if (data.notes) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Observações:', margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      const notesLines = doc.splitTextToSize(data.notes, pageWidth - 2 * margin);
      doc.text(notesLines, margin, y);
      y += notesLines.length * 4 + 5;
    }

    // Seller
    if (data.sellerName) {
      y += 5;
      doc.setFontSize(9);
      doc.text(`Vendedor: ${data.sellerName}`, margin, y);
    }

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
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
