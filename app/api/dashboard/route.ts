import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth";
import { query } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const targetDateParam = searchParams.get("date")?.trim();
  const startDateParam = searchParams.get("startDate")?.trim() || searchParams.get("start")?.trim();
  const endDateParam = searchParams.get("endDate")?.trim() || searchParams.get("end")?.trim();
  const mode = searchParams.get("mode")?.trim();

  const isRange = Boolean(
    (startDateParam && /^\d{4}-\d{2}-\d{2}$/.test(startDateParam) && endDateParam && /^\d{4}-\d{2}-\d{2}$/.test(endDateParam)) ||
    mode === "finance"
  );

  let rangeStartSql: string;
  let rangeEndSql: string;

  if (startDateParam && /^\d{4}-\d{2}-\d{2}$/.test(startDateParam) && endDateParam && /^\d{4}-\d{2}-\d{2}$/.test(endDateParam)) {
    rangeStartSql = `'${startDateParam}'::date`;
    rangeEndSql = `'${endDateParam}'::date`;
  } else if (mode === "finance") {
    rangeStartSql = `date_trunc('month', (NOW() AT TIME ZONE 'America/Sao_Paulo'))::date`;
    rangeEndSql = `(NOW() AT TIME ZONE 'America/Sao_Paulo')::date`;
  } else {
    const isValidDate = targetDateParam && /^\d{4}-\d{2}-\d{2}$/.test(targetDateParam);
    const dateExpr = isValidDate
      ? `'${targetDateParam}'::date`
      : `(NOW() AT TIME ZONE 'America/Sao_Paulo')::date`;
    rangeStartSql = `${dateExpr} - 13`;
    rangeEndSql = dateExpr;
  }

  const isValidDate = targetDateParam && /^\d{4}-\d{2}-\d{2}$/.test(targetDateParam);
  const singleDateExpr = isValidDate
    ? `'${targetDateParam}'::date`
    : `(NOW() AT TIME ZONE 'America/Sao_Paulo')::date`;

  const [summary, hourly, days, payments, products, finance] = await Promise.all([
    query(
      isRange
        ? `SELECT COALESCE(SUM(total_cents) FILTER (WHERE status<>'cancelled'),0)::int AS revenue,
                  COUNT(*) FILTER (WHERE status<>'cancelled')::int AS orders,
                  COALESCE(AVG(total_cents) FILTER (WHERE status<>'cancelled'),0)::int AS ticket,
                  COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(ready_at,NOW())-created_at))/60)
                    FILTER (WHERE ready_at IS NOT NULL),0)::numeric(10,1) AS "avgMinutes"
           FROM orders
           WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= ${rangeStartSql}
             AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= ${rangeEndSql}`
        : `SELECT COALESCE(SUM(total_cents) FILTER (WHERE status<>'cancelled'),0)::int AS revenue,
                  COUNT(*) FILTER (WHERE status<>'cancelled')::int AS orders,
                  COALESCE(AVG(total_cents) FILTER (WHERE status<>'cancelled'),0)::int AS ticket,
                  COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(ready_at,NOW())-created_at))/60)
                    FILTER (WHERE ready_at IS NOT NULL),0)::numeric(10,1) AS "avgMinutes"
           FROM orders
           WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date = ${singleDateExpr}`
    ),
    query(`SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo')::int AS hour,
                  COALESCE(SUM(total_cents),0)::int AS value
           FROM orders
           WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date = ${isRange ? rangeEndSql : singleDateExpr}
             AND status<>'cancelled'
           GROUP BY 1 ORDER BY 1`),
    query(`SELECT TO_CHAR((created_at AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD') AS day,
                  COALESCE(SUM(total_cents),0)::int AS value,
                  COUNT(*)::int AS orders
           FROM orders
           WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= ${rangeStartSql}
             AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= ${rangeEndSql}
             AND status<>'cancelled'
           GROUP BY 1 ORDER BY 1`),
    query(`SELECT payment_method AS name,COUNT(*)::int AS count,COALESCE(SUM(total_cents),0)::int AS value
           FROM orders
           WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= ${rangeStartSql}
             AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= ${rangeEndSql}
             AND status<>'cancelled'
           GROUP BY payment_method ORDER BY value DESC`),
    query(`SELECT oi.product_name AS name,SUM(oi.quantity)::int AS quantity,
                  SUM(oi.quantity*oi.unit_price_cents)::int AS value
           FROM order_items oi JOIN orders o ON o.id=oi.order_id
           WHERE (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= ${rangeStartSql}
             AND (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= ${rangeEndSql}
             AND o.status<>'cancelled'
           GROUP BY oi.product_name ORDER BY quantity DESC LIMIT 5`),
    query(
      isRange
        ? `SELECT
             COALESCE(SUM(amount_cents) FILTER (WHERE entry_type='income'),0)::int AS income,
             COALESCE(SUM(amount_cents) FILTER (WHERE entry_type='expense'),0)::int AS expense
           FROM finance_entries
           WHERE entry_date >= ${rangeStartSql} AND entry_date <= ${rangeEndSql}`
        : `SELECT
             COALESCE(SUM(amount_cents) FILTER (WHERE entry_type='income'),0)::int AS income,
             COALESCE(SUM(amount_cents) FILTER (WHERE entry_type='expense'),0)::int AS expense
           FROM finance_entries
           WHERE date_trunc('month',entry_date) = date_trunc('month', ${singleDateExpr})`
    ),
  ]);

  return NextResponse.json({
    summary: summary.rows[0] || { revenue: 0, orders: 0, ticket: 0, avgMinutes: 0 },
    hourly: hourly.rows || [],
    days: days.rows || [],
    payments: payments.rows || [],
    products: products.rows || [],
    finance: finance.rows[0] || { income: 0, expense: 0 },
    selectedDate: targetDateParam || null,
    startDate: startDateParam || null,
    endDate: endDateParam || null,
    isRange,
  });
}
