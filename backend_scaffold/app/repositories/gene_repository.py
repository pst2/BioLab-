from __future__ import annotations

from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.models import GeneRecord


class GeneRepository:
    def __init__(self, db: Session):
        self.db = db

    def search(self, keyword: str, limit: int = 20) -> list[dict[str, Any]]:
        term = f"%{keyword.strip()}%"
        rows = (
            self.db.query(GeneRecord)
            .filter(
                or_(
                    GeneRecord.symbol.ilike(term),
                    GeneRecord.name.ilike(term),
                    GeneRecord.description.ilike(term),
                    GeneRecord.organism.ilike(term),
                    GeneRecord.ncbi_gene_id.ilike(term),
                )
            )
            .order_by(GeneRecord.updated_at.desc())
            .limit(limit)
            .all()
        )
        return [self.to_dict(row) for row in rows]

    def get_by_gene_id(self, gene_id: str) -> dict[str, Any] | None:
        gid = str(gene_id).strip()
        base_gid = gid.split(".")[0] if "." in gid else gid
        row = (
            self.db.query(GeneRecord)
            .filter(
                (GeneRecord.ncbi_gene_id == gid)
                | (GeneRecord.accession_version == gid)
                | (GeneRecord.ncbi_gene_id == base_gid)
                | (GeneRecord.accession_version.ilike(f"{base_gid}%"))
                | (GeneRecord.id == self._safe_int(gid))
                | (GeneRecord.symbol.ilike(gid))
                | (GeneRecord.symbol.ilike(base_gid))
            )
            .first()
        )
        return self.to_dict(row) if row else None

    def upsert_many(self, items: list[dict[str, Any]], source: str = "ncbi") -> None:
        for item in items:
            self.upsert(item, source=source)
        self.db.commit()

    def upsert(self, item: dict[str, Any], source: str = "ncbi") -> GeneRecord:
        symbol = (item.get("symbol") or item.get("name") or "").strip() or "Unknown"
        organism = (item.get("organism") or "Unknown").strip() or "Unknown"
        ncbi_gene_id = str(item.get("gene_id") or item.get("ncbi_gene_id") or "").strip() or None
        data_type = str(item.get("data_type") or "gene").lower()
        acc = str(
            item.get("accession_version")
            or item.get("genomic_accession")
            or item.get("external_id")
            or item.get("caption")
            or ""
        ).strip() or None

        query = self.db.query(GeneRecord)
        row = None
        if ncbi_gene_id:
            row = query.filter(GeneRecord.ncbi_gene_id == ncbi_gene_id).first()
        if row is None and acc:
            row = query.filter((GeneRecord.accession_version == acc) | (GeneRecord.ncbi_gene_id == acc)).first()
        if row is None and data_type == "gene":
            row = query.filter(GeneRecord.symbol == symbol, GeneRecord.organism == organism).first()

        # Disambiguate if (symbol, organism) collides with an existing row under uq_gene_symbol_organism
        existing_collision = query.filter(
            GeneRecord.symbol == symbol,
            GeneRecord.organism == organism,
            GeneRecord.id != (row.id if row else None),
        ).first()

        if existing_collision:
            dist_id = acc or ncbi_gene_id
            if dist_id and dist_id != symbol:
                symbol = f"{symbol} ({dist_id})"
                if query.filter(
                    GeneRecord.symbol == symbol,
                    GeneRecord.organism == organism,
                    GeneRecord.id != (row.id if row else None),
                ).first():
                    symbol = dist_id

        if row is None:
            row = GeneRecord(symbol=symbol, organism=organism)
            self.db.add(row)

        row.symbol = symbol
        row.name = item.get("name") or item.get("description") or ""
        row.description = item.get("description") or item.get("summary") or ""
        row.organism = organism
        row.ncbi_gene_id = ncbi_gene_id
        row.genome_assembly = item.get("genome_assembly") or item.get("assembly")
        raw_taxid = item.get("taxid") or item.get("taxonomy_id")
        row.taxid = int(raw_taxid) if raw_taxid and str(raw_taxid).isdigit() else None
        row.accession_version = item.get("accession_version") or item.get("genomic_accession") or acc
        row.source = source
        row.payload = item
        return row

    def to_dict(self, row: GeneRecord) -> dict[str, Any]:
        payload = row.payload or {}
        data = {
            "id": row.id,
            "gene_id": row.ncbi_gene_id or str(row.id),
            "symbol": row.symbol,
            "name": row.name,
            "description": row.description,
            "organism": row.organism,
            "genome_assembly": row.genome_assembly,
            "taxid": row.taxid,
            "accession_version": row.accession_version,
            "source": row.source,
        }
        data.update({key: value for key, value in payload.items() if key not in data or not data[key]})
        data["local_id"] = row.id
        data["source"] = row.source
        return data

    def _safe_int(self, value: str) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return -1
