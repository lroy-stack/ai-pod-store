import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';

export const POST = withAuth(async (req, session) => {
  try {
    const { report } = await req.json();

    if (!report) {
      return NextResponse.json(
        { error: 'No report data provided' },
        { status: 400 }
      );
    }

    // Build CSV content
    let csvContent = '';

    // --- SUMMARY SECTION ---
    if (report.summary) {
      csvContent += 'FINANCIAL SUMMARY\n';
      csvContent += 'Metric,Value\n';
      csvContent += `Total Revenue,${report.summary.totalRevenue}\n`;
      csvContent += `Total Orders,${report.summary.totalOrders}\n`;
      csvContent += `Average Order Value,${report.summary.averageOrderValue}\n`;
      csvContent += `Currency,${report.summary.currency}\n`;
      csvContent += '\n';
    }

    // --- PROFIT & LOSS STATEMENT ---
    if (report.profitAndLoss) {
      csvContent += 'PROFIT & LOSS STATEMENT\n';
      csvContent += 'Item,Amount\n';
      csvContent += `Revenue,${report.profitAndLoss.revenue}\n`;
      csvContent += `Total Costs,${report.profitAndLoss.costs}\n`;
      csvContent += `Gross Profit,${report.profitAndLoss.grossProfit}\n`;
      csvContent += `Gross Margin %,${report.profitAndLoss.grossMarginPercent}\n`;
      csvContent += '\n';

      csvContent += 'COST BREAKDOWN\n';
      csvContent += 'Category,Amount\n';
      csvContent += `Printful Production Costs,${report.profitAndLoss.breakdown.printfulCosts}\n`;
      csvContent += `Payment Processing (Stripe),${report.profitAndLoss.breakdown.stripeFees}\n`;
      csvContent += `Operational & Platform Costs,${report.profitAndLoss.breakdown.operationalCosts}\n`;
      csvContent += '\n';
    }

    // --- MONTHLY REVENUE TRENDS ---
    if (report.monthlyRevenue && report.monthlyRevenue.length > 0) {
      csvContent += 'MONTHLY REVENUE TRENDS (LAST 12 MONTHS)\n';
      csvContent += 'Month,Revenue,Orders\n';
      report.monthlyRevenue.forEach((month: any) => {
        csvContent += `${month.month},${month.revenue},${month.orders}\n`;
      });
      csvContent += '\n';
    }

    // --- CATEGORY MARGIN BREAKDOWN ---
    if (report.categoryMarginBreakdown && report.categoryMarginBreakdown.length > 0) {
      csvContent += 'MARGIN ANALYSIS BY CATEGORY\n';
      csvContent += 'Category,Revenue,Quantity Sold,Estimated Margin,Margin %\n';
      report.categoryMarginBreakdown.forEach((category: any) => {
        csvContent += `${category.category},${category.revenue},${category.quantity},${category.estimatedMargin},${category.marginPercent}\n`;
      });
      csvContent += '\n';
    }

    // --- PRODUCT PERFORMANCE & MARGINS ---
    if (report.productMargins && report.productMargins.length > 0) {
      csvContent += 'PRODUCT PERFORMANCE & MARGINS\n';
      csvContent += 'Product ID,Product Name,Category,Quantity Sold,Revenue,Estimated Margin,Margin %\n';
      report.productMargins.forEach((product: any) => {
        // Escape product name in case it contains commas
        const productName = product.productName.replace(/"/g, '""');
        csvContent += `${product.productId},"${productName}",${product.category},${product.quantity},${product.revenue},${product.estimatedMargin},${product.marginPercent}\n`;
      });
      csvContent += '\n';
    }

    // --- CASH FLOW (SIMPLIFIED) ---
    const operatingCashFlow = report.profitAndLoss.grossProfit;
    const investingCashFlow = 0;
    const financingCashFlow = 0;
    const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;

    csvContent += 'CASH FLOW STATEMENT (SIMPLIFIED)\n';
    csvContent += 'Activity Type,Amount\n';
    csvContent += `Operating Cash Flow,${operatingCashFlow}\n`;
    csvContent += `Investing Cash Flow,${investingCashFlow}\n`;
    csvContent += `Financing Cash Flow,${financingCashFlow}\n`;
    csvContent += `Net Cash Flow,${netCashFlow}\n`;
    csvContent += '\n';

    // Return CSV as downloadable file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="finance-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error generating finance export:', error);
    return NextResponse.json(
      { error: 'Failed to generate export' },
      { status: 500 }
    );
  }
})
