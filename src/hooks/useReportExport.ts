import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

interface DateRange {
  from: Date;
  to: Date;
}

// Generic CSV export
function downloadCSV(data: Record<string, any>[], filename: string) {
  if (!data.length) {
    toast.error('Sem dados para exportar');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(';'),
    ...data.map(row => headers.map(h => {
      const value = row[h];
      if (typeof value === 'number') return value.toString().replace('.', ',');
      if (typeof value === 'string' && value.includes(';')) return `"${value}"`;
      return value ?? '';
    }).join(';'))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast.success('CSV exportado com sucesso!');
}

// Generic Excel export
function downloadExcel(sheets: { name: string; data: Record<string, any>[] }[], filename: string) {
  const hasData = sheets.some(s => s.data.length > 0);
  if (!hasData) {
    toast.error('Sem dados para exportar');
    return;
  }

  const wb = XLSX.utils.book_new();
  sheets.forEach(sheet => {
    if (sheet.data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(sheet.data);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
    }
  });
  
  XLSX.writeFile(wb, `${filename}.xlsx`);
  toast.success('Excel exportado com sucesso!');
}

// Generic PDF export
function downloadPDF(title: string, dateRange: DateRange | undefined, tables: { title: string; headers: string[]; rows: string[][] }[], filename: string) {
  const hasData = tables.some(t => t.rows.length > 0);
  if (!hasData) {
    toast.error('Sem dados para exportar');
    return;
  }

  const doc = new jsPDF();
  let yPos = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, yPos);
  yPos += 10;

  // Date range
  if (dateRange) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}`, 14, yPos);
    yPos += 15;
  }

  tables.forEach(table => {
    if (table.rows.length === 0) return;

    // Table title
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(table.title, 14, yPos);
    yPos += 8;

    // Table headers
    const colWidth = (doc.internal.pageSize.width - 28) / table.headers.length;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(14, yPos - 4, doc.internal.pageSize.width - 28, 8, 'F');
    
    table.headers.forEach((header, i) => {
      doc.text(header, 14 + (i * colWidth), yPos);
    });
    yPos += 8;

    // Table rows
    doc.setFont('helvetica', 'normal');
    table.rows.forEach(row => {
      if (yPos > doc.internal.pageSize.height - 20) {
        doc.addPage();
        yPos = 20;
      }
      row.forEach((cell, i) => {
        doc.text(String(cell).slice(0, 25), 14 + (i * colWidth), yPos);
      });
      yPos += 6;
    });
    yPos += 10;
  });

  doc.save(`${filename}.pdf`);
  toast.success('PDF exportado com sucesso!');
}

// ============ Export functions for each report ============

export function exportSLAReport(
  exportFormat: 'csv' | 'excel' | 'pdf',
  dateRange: DateRange | undefined,
  data: {
    metrics: { total_bom: number; total_regular: number; total_critico: number; avg_tma_minutes: number };
    agents: { agent_name: string; total: number; bom: number; regular: number; critico: number; sla_good_percent: number }[];
    departments: { name: string; value: number }[];
  } | undefined
) {
  if (!data) {
    toast.error('Sem dados para exportar');
    return;
  }

  const dateStr = dateRange ? `${format(dateRange.from, 'dd-MM-yyyy')}_${format(dateRange.to, 'dd-MM-yyyy')}` : 'periodo';
  const filename = `relatorio_sla_${dateStr}`;

  const agentsData = data.agents.map(a => ({
    'Atendente': a.agent_name,
    'Total': a.total,
    'Bom': a.bom,
    'Regular': a.regular,
    'Crítico': a.critico,
    '% SLA Bom': a.sla_good_percent
  }));

  if (exportFormat === 'csv') {
    downloadCSV(agentsData, filename);
  } else if (exportFormat === 'excel') {
    downloadExcel([
      { name: 'Resumo', data: [{ 'SLA Bom': data.metrics.total_bom, 'SLA Regular': data.metrics.total_regular, 'SLA Crítico': data.metrics.total_critico, 'TMA Geral (min)': data.metrics.avg_tma_minutes }] },
      { name: 'Por Atendente', data: agentsData },
      { name: 'Por Departamento', data: data.departments.map(d => ({ 'Departamento': d.name, 'TMA (min)': d.value })) }
    ], filename);
  } else {
    downloadPDF('Relatório de SLA', dateRange, [
      { title: 'Por Atendente', headers: ['Atendente', 'Total', 'Bom', 'Regular', 'Crítico', '% SLA'], rows: data.agents.map(a => [a.agent_name, String(a.total), String(a.bom), String(a.regular), String(a.critico), `${a.sla_good_percent}%`]) }
    ], filename);
  }
}

export function exportAttendanceReport(
  exportFormat: 'csv' | 'excel' | 'pdf',
  dateRange: DateRange | undefined,
  data: {
    metrics: { total: number; open: number; closed: number; pending: number };
    byChannel: { channel: string; value: number }[];
    byHour: { hour: string; value: number }[];
  } | undefined
) {
  if (!data) {
    toast.error('Sem dados para exportar');
    return;
  }

  const dateStr = dateRange ? `${format(dateRange.from, 'dd-MM-yyyy')}_${format(dateRange.to, 'dd-MM-yyyy')}` : 'periodo';
  const filename = `relatorio_atendimentos_${dateStr}`;

  if (exportFormat === 'csv') {
    downloadCSV(data.byChannel.map(c => ({ 'Canal': c.channel, 'Quantidade': c.value })), filename);
  } else if (exportFormat === 'excel') {
    downloadExcel([
      { name: 'Resumo', data: [{ 'Total': data.metrics.total, 'Abertos': data.metrics.open, 'Fechados': data.metrics.closed, 'Pendentes': data.metrics.pending }] },
      { name: 'Por Canal', data: data.byChannel.map(c => ({ 'Canal': c.channel, 'Quantidade': c.value })) },
      { name: 'Por Hora', data: data.byHour.map(h => ({ 'Hora': h.hour, 'Quantidade': h.value })) }
    ], filename);
  } else {
    downloadPDF('Relatório de Atendimentos', dateRange, [
      { title: 'Resumo', headers: ['Total', 'Abertos', 'Fechados', 'Pendentes'], rows: [[String(data.metrics.total), String(data.metrics.open), String(data.metrics.closed), String(data.metrics.pending)]] },
      { title: 'Por Canal', headers: ['Canal', 'Quantidade'], rows: data.byChannel.map(c => [c.channel, String(c.value)]) }
    ], filename);
  }
}

export function exportSalesReport(
  exportFormat: 'csv' | 'excel' | 'pdf',
  dateRange: DateRange | undefined,
  data: {
    sellers: { rank: number; name: string; orders_count: number; revenue: number; avg_ticket: number }[];
    totalRevenue: number;
    totalConversions: number;
  } | undefined
) {
  if (!data) {
    toast.error('Sem dados para exportar');
    return;
  }

  const dateStr = dateRange ? `${format(dateRange.from, 'dd-MM-yyyy')}_${format(dateRange.to, 'dd-MM-yyyy')}` : 'periodo';
  const filename = `relatorio_vendas_${dateStr}`;

  const sellersData = data.sellers.map(s => ({
    'Posição': s.rank,
    'Vendedor': s.name,
    'Pedidos': s.orders_count,
    'Faturamento': s.revenue,
    'Ticket Médio': s.avg_ticket
  }));

  if (exportFormat === 'csv') {
    downloadCSV(sellersData, filename);
  } else if (exportFormat === 'excel') {
    downloadExcel([
      { name: 'Resumo', data: [{ 'Faturamento Total': data.totalRevenue, 'Total Conversões': data.totalConversions }] },
      { name: 'Por Vendedor', data: sellersData }
    ], filename);
  } else {
    downloadPDF('Relatório de Vendas', dateRange, [
      { title: 'Ranking de Vendedores', headers: ['#', 'Vendedor', 'Pedidos', 'Faturamento', 'Ticket'], rows: data.sellers.map(s => [String(s.rank), s.name, String(s.orders_count), `R$ ${s.revenue.toLocaleString()}`, `R$ ${s.avg_ticket.toLocaleString()}`]) }
    ], filename);
  }
}

export function exportPerformanceReport(
  exportFormat: 'csv' | 'excel' | 'pdf',
  dateRange: DateRange | undefined,
  data: {
    agents: { name: string; total_conversations: number; total_sales: number; revenue: number; sla_good_percent: number }[];
  } | undefined
) {
  if (!data) {
    toast.error('Sem dados para exportar');
    return;
  }

  const dateStr = dateRange ? `${format(dateRange.from, 'dd-MM-yyyy')}_${format(dateRange.to, 'dd-MM-yyyy')}` : 'periodo';
  const filename = `relatorio_performance_${dateStr}`;

  const agentsData = data.agents.map(a => ({
    'Atendente': a.name,
    'Atendimentos': a.total_conversations,
    'Vendas': a.total_sales,
    'Faturamento': a.revenue,
    '% SLA Bom': a.sla_good_percent
  }));

  if (exportFormat === 'csv') {
    downloadCSV(agentsData, filename);
  } else if (exportFormat === 'excel') {
    downloadExcel([{ name: 'Performance', data: agentsData }], filename);
  } else {
    downloadPDF('Relatório de Performance', dateRange, [
      { title: 'Por Atendente', headers: ['Atendente', 'Atendimentos', 'Vendas', 'Faturamento', 'SLA %'], rows: data.agents.map(a => [a.name, String(a.total_conversations), String(a.total_sales), `R$ ${a.revenue.toLocaleString()}`, `${a.sla_good_percent}%`]) }
    ], filename);
  }
}
