import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';

export const POST = withAuth(async (req, session) => {
  try {
    const { report, rfmData, demandData } = await req.json();

    // Build CSV content
    let csvContent = '';

    // --- SUMMARY SECTION ---
    if (report?.summary) {
      csvContent += 'FINANCIAL SUMMARY\n';
      csvContent += 'Metric,Value\n';
      csvContent += `Total Revenue,${report.summary.totalRevenue}\n`;
      csvContent += `Total Orders,${report.summary.totalOrders}\n`;
      csvContent += `Average Order Value,${report.summary.averageOrderValue}\n`;
      csvContent += `Currency,${report.summary.currency}\n`;
      csvContent += '\n';
    }

    // --- PROFIT & LOSS ---
    if (report?.profitAndLoss) {
      csvContent += 'PROFIT & LOSS STATEMENT\n';
      csvContent += 'Item,Amount\n';
      csvContent += `Revenue,${report.profitAndLoss.revenue}\n`;
      csvContent += `Costs,${report.profitAndLoss.costs}\n`;
      csvContent += `Gross Profit,${report.profitAndLoss.grossProfit}\n`;
      csvContent += `Gross Margin %,${report.profitAndLoss.grossMarginPercent}\n`;
      csvContent += '\n';

      csvContent += 'COST BREAKDOWN\n';
      csvContent += 'Category,Amount\n';
      csvContent += `Printful Costs,${report.profitAndLoss.breakdown.printfulCosts}\n`;
      csvContent += `Stripe Fees,${report.profitAndLoss.breakdown.stripeFees}\n`;
      csvContent += `Operational Costs,${report.profitAndLoss.breakdown.operationalCosts}\n`;
      csvContent += '\n';
    }

    // --- RFM CUSTOMER SEGMENTATION ---
    if (rfmData?.segments) {
      csvContent += 'RFM CUSTOMER SEGMENTATION\n';
      csvContent += 'Segment,Customer Count\n';
      csvContent += `Champions,${rfmData.segments.champions}\n`;
      csvContent += `Loyal,${rfmData.segments.loyal}\n`;
      csvContent += `Potential,${rfmData.segments.potential}\n`;
      csvContent += `At Risk,${rfmData.segments.atRisk}\n`;
      csvContent += `Hibernating,${rfmData.segments.hibernating}\n`;
      csvContent += `Lost,${rfmData.segments.lost}\n`;
      csvContent += `Total Customers,${rfmData.totalCustomers}\n`;
      csvContent += '\n';
    }

    // --- DEMAND FORECAST ---
    if (demandData?.forecast && demandData.forecast.length > 0) {
      csvContent += 'DEMAND FORECAST (4-WEEK OUTLOOK)\n';
      csvContent += 'Week,Orders (Lower),Orders (Forecast),Orders (Upper),Revenue (Forecast)\n';
      demandData.forecast.forEach((week: any) => {
        csvContent += `${week.week},${week.ordersLower},${week.ordersForecast},${week.ordersUpper},${week.revenueForecast}\n`;
      });
      csvContent += '\n';

      if (demandData.summary) {
        csvContent += 'DEMAND SUMMARY\n';
        csvContent += 'Metric,Value\n';
        csvContent += `Avg Weekly Orders,${demandData.summary.avgWeeklyOrders}\n`;
        csvContent += `Avg Weekly Revenue,${demandData.summary.avgWeeklyRevenue}\n`;
        csvContent += `Trend,${demandData.summary.trend}\n`;
        csvContent += `Trend Value,${demandData.summary.trendValue}\n`;
        csvContent += '\n';
      }
    }

    // --- MONTHLY REVENUE ---
    if (report?.monthlyRevenue && report.monthlyRevenue.length > 0) {
      csvContent += 'MONTHLY REVENUE (LAST 12 MONTHS)\n';
      csvContent += 'Month,Revenue,Orders\n';
      report.monthlyRevenue.forEach((month: any) => {
        csvContent += `${month.month},${month.revenue},${month.orders}\n`;
      });
      csvContent += '\n';
    }

    // --- CATEGORY MARGIN BREAKDOWN ---
    if (report?.categoryMarginBreakdown && report.categoryMarginBreakdown.length > 0) {
      csvContent += 'MARGIN ANALYSIS BY CATEGORY\n';
      csvContent += 'Category,Revenue,Quantity,Estimated Margin,Margin %\n';
      report.categoryMarginBreakdown.forEach((category: any) => {
        csvContent += `${category.category},${category.revenue},${category.quantity},${category.estimatedMargin},${category.marginPercent}\n`;
      });
      csvContent += '\n';
    }

    // --- PRODUCT MARGINS ---
    if (report?.productMargins && report.productMargins.length > 0) {
      csvContent += 'PRODUCT PERFORMANCE & MARGINS\n';
      csvContent += 'Product ID,Product Name,Category,Quantity Sold,Revenue,Estimated Margin,Margin %\n';
      report.productMargins.forEach((product: any) => {
        // Escape product name in case it contains commas
        const productName = product.productName.replace(/"/g, '""');
        csvContent += `${product.productId},"${productName}",${product.category},${product.quantity},${product.revenue},${product.estimatedMargin},${product.marginPercent}\n`;
      });
      csvContent += '\n';
    }

    // Return CSV as downloadable file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="analytics-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error generating analytics export:', error);
    return NextResponse.json(
      { error: 'Failed to generate export' },
      { status: 500 }
    );
  }
});
