import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth";
import { query } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (process.env.SMACK_MODE !== "panel") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const [summary, hourly, days, payments, products, finance] = await Promise.all([
    query(`SELECT COALESCE(SUM(total_cents) FILTER (WHERE status<>'cancelled'),0)::int AS revenue,
                  COUNT(*) FILTER (WHERE status<>'cancelled')::int AS orders,
                  COALESCE(AVG(total_cents) FILTER (WHERE status<>'cancelled'),0)::int AS ticket,
                  COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(ready_at,NOW())-created_at))/60)
                    FILTER (WHERE ready_at IS NOT NULL),0)::numeric(10,1) AS "avgMinutes"
           FROM orders
           WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date=(NOW() AT TIME ZONE 'America/Sao_Paulo')::date`),
    query(`SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo')::int AS hour,COALESCE(SUM(total_cents),0)::int AS value
           FROM orders
           WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date=(NOW() AT TIME ZONE 'America/Sao_Paulo')::date
             AND status<>'cancelled'
           GROUP BY 1 ORDER BY 1`),
    query(`SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,COALESCE(SUM(total_cents),0)::int AS value,COUNT(*)::int AS orders
           FROM orders
           WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date-13
             AND status<>'cancelled'
           GROUP BY 1 ORDER BY 1`),
    query(`SELECT payment_method AS name,COUNT(*)::int AS count,COALESCE(SUM(total_cents),0)::int AS value
           FROM orders
           WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date=(NOW() AT TIME ZONE 'America/Sao_Paulo')::date
             AND status<>'cancelled'
           GROUP BY payment_method ORDER BY value DESC`),
    query(`SELECT oi.product_name AS name,SUM(oi.quantity)::int AS quantity,
                  SUM(oi.quantity*oi.unit_price_cents)::int AS value
           FROM order_items oi JOIN orders o ON o.id=oi.order_id
           WHERE (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date=(NOW() AT TIME ZONE 'America/Sao_Paulo')::date
             AND o.status<>'cancelled'
           GROUP BY oi.product_name ORDER BY quantity DESC LIMIT 5`),
    query(`SELECT
             COALESCE(SUM(amount_cents) FILTER (WHERE entry_type='income'),0)::int AS income,
             COALESCE(SUM(amount_cents) FILTER (WHERE entry_type='expense'),0)::int AS expense
           FROM finance_entries
           WHERE date_trunc('month',entry_date)=date_trunc('month',(NOW() AT TIME ZONE 'America/Sao_Paulo')::date)`),
  ]);
  return NextResponse.json({
    summary: summary.rows[0],
    hourly: hourly.rows,
    days: days.rows,
    payments: payments.rows,
    products: products.rows,
    finance: finance.rows[0],
  });
}
