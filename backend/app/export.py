import csv
import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def build_csv(summary, resolutions):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["order_id", "status", "confidence", "resolved", "resolution_note", "resolved_at"])
    for r in summary["records"]:
        order_id = r.get("order_id") or ""
        res = resolutions.get(order_id) if order_id else None
        writer.writerow([
            order_id,
            r.get("status", ""),
            r.get("confidence", ""),
            "yes" if res else "no",
            res["note"] if res else "",
            res["resolved_at"] if res else "",
        ])
    return buf.getvalue()


def build_pdf(summary, resolutions):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("Settl.ai &mdash; Reconciliation Report", styles["Title"]))
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    story.append(Paragraph(f"Generated {generated}", styles["Normal"]))
    story.append(Spacer(1, 16))

    clean_count = summary["breakdown"].get("clean_match", {}).get("count", 0)
    stats_data = [
        ["Total records", str(summary["total_records"])],
        ["Match rate", f"{summary['match_rate'] * 100:.1f}%"],
        ["Clean matches", str(clean_count)],
        ["Exceptions", str(summary["total_records"] - clean_count)],
    ]
    stats_table = Table(stats_data, colWidths=[200, 200])
    stats_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#6b7280")),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 20))

    story.append(Paragraph("Breakdown by status", styles["Heading2"]))
    breakdown_rows = [["Status", "Count"]]
    for status, info in summary["breakdown"].items():
        breakdown_rows.append([status, str(info.get("count", 0))])
    breakdown_table = Table(breakdown_rows, colWidths=[250, 100])
    breakdown_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1c2230")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#3a3f52")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(breakdown_table)
    story.append(Spacer(1, 20))

    exceptions = [r for r in summary["records"] if r.get("status") != "clean_match"]
    story.append(Paragraph(f"Exceptions ({len(exceptions)})", styles["Heading2"]))
    exc_rows = [["Order ID", "Status", "Confidence", "Resolved"]]
    for r in exceptions:
        order_id = r.get("order_id") or "\u2014"
        res = resolutions.get(r.get("order_id")) if r.get("order_id") else None
        exc_rows.append([
            order_id,
            r.get("status", ""),
            str(r.get("confidence", "")),
            "Yes" if res else "No",
        ])
    exc_table = Table(exc_rows, colWidths=[130, 140, 80, 80], repeatRows=1)
    exc_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1c2230")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#3a3f52")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(exc_table)

    doc.build(story)
    buf.seek(0)
    return buf