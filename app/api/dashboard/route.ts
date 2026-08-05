import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth";
import { query } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const targetDateParam = request.nextUrl.searchParams.get("date");
  const isValidDate = targetDateParam && /^\d{4}-\d{2}-\d{2}$/.test(targetDateParam);
  
  const dateExpr = isValidDate
    ? `'${targetDateParam}'::date`
    : `(NOW() AT TIME ZONE 'America/Sao_Paulo')::date`;

  const [summary, hourly, days, payments, products, finance] = await Promise.all([
    query(`SELECT COALESCE(SUM(total_cents) FILTER (WHERE status<>'cancelled'),0)::int AS revenue,
                  COUNT(*) FILTER (WHERE status<>'cancelled')::int AS orders,
                  COALESCE(AVG(total_cents) FILTER (WHERE status<>'cancelled'),0)::int AS ticket,
                  COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(ready_at,NOW())-created_at))/60)
                    FILTER (WHERE ready_at IS NOT NULL),0)::numeric(10,1) AS "avgMinutes"
           FROM orders
           WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date = ${dateExpr}`),
    query(`SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo')::int AS hour,
                  COALESCE(SUM(total_cents),0)::int AS value
           FROM orders
           WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date = ${dateExpr}
             AND status<>'cancelled'
           GROUP BY 1 ORDER BY 1`),
    query(`SELECT TO_CHAR((created_at AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD') AS day,
                  COALESCE(SUM(total_cents),0)::int AS value,
                  COUNT(*)::int AS orders
           FROM orders
           WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= ${dateExpr} - 13
             AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= ${dateExpr}
             AND status<>'cancelled'
           GROUP BY 1 ORDER BY 1`),
    query(`SELECT payment_method AS name,COUNT(*)::int AS count,COALESCE(SUM(total_cents),0)::int AS value
           FROM orders
           WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date = ${dateExpr}
             AND status<>'cancelled'
           GROUP BY payment_method ORDER BY value DESC`),
    query(`SELECT oi.product_name AS name,SUM(oi.quantity)::int AS quantity,
                  SUM(oi.quantity*oi.unit_price_cents)::int AS value
           FROM order_items oi JOIN orders o ON o.id=oi.order_id
           WHERE (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date = ${dateExpr}
             AND o.status<>'cancelled'
           GROUP BY oi.product_name ORDER BY quantity DESC LIMIT 5`),
    query(`SELECT
             COALESCE(SUM(amount_cents) FILTER (WHERE entry_type='income'),0)::int AS income,
             COALESCE(SUM(amount_cents) FILTER (WHERE entry_type='expense'),0)::int AS expense
           FROM finance_entries
           WHERE date_trunc('month',entry_date) = date_trunc('month', ${dateExpr})`),
  ]);

  return NextResponse.json({
    summary: summary.rows[0] || { revenue: 0, orders: 0, ticket: 0, avgMinutes: 0 },
    hourly: hourly.rows || [],
    days: days.rows || [],
    payments: payments.rows || [],
    products: products.rows || [],
    finance: finance.rows[0] || { income: 0, expense: 0 },
    selectedDate: targetDateParam || null,
  });
}
