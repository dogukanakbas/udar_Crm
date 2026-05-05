"""Basit MDF stok / çıkış PDF raporları (reportlab)."""
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def build_mdf_stock_pdf(title: str, rows: list[tuple]) -> bytes:
    """
    rows: list of (kalınlık str, en x boy, adet str, eşik str, durum str)
    """
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), rightMargin=16 * mm, leftMargin=16 * mm, topMargin=14 * mm, bottomMargin=14 * mm)
    styles = getSampleStyleSheet()
    story = [Paragraph(title, styles['Title']), Spacer(1, 8 * mm)]
    data = [['Kalinlik', 'En x Boy (cm)', 'Mevcut', 'Min. esik', 'Durum']]
    data.extend(rows)
    t = Table(data, colWidths=[28 * mm, 40 * mm, 32 * mm, 28 * mm, 120 * mm])
    t.setStyle(
        TableStyle(
            [
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e5e7eb')),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
            ]
        )
    )
    story.append(t)
    doc.build(story)
    return buf.getvalue()


def build_mdf_exits_pdf(title: str, rows: list[tuple]) -> bytes:
    """
    rows: list of (tarih, kalınlık, en×boy, adet str, kullanım yeri)
    """
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), rightMargin=16 * mm, leftMargin=16 * mm, topMargin=14 * mm, bottomMargin=14 * mm)
    styles = getSampleStyleSheet()
    story = [Paragraph(title, styles['Title']), Spacer(1, 8 * mm)]
    data = [['Tarih', 'Kalinlik', 'En x Boy (cm)', 'Adet', 'Kullanim yeri']]
    data.extend(rows)
    t = Table(data, colWidths=[28 * mm, 24 * mm, 36 * mm, 22 * mm, 150 * mm])
    t.setStyle(
        TableStyle(
            [
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#fee2e2')),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fef2f2')]),
            ]
        )
    )
    story.append(t)
    doc.build(story)
    return buf.getvalue()
