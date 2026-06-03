# Add this route below /search in backend_scaffold/app/api/routes/genes.py

@router.get("/{gene_id}")
@limiter.limit(settings.RATE_LIMIT_SEARCH)
async def get_gene_detail(
    request: Request,
    gene_id: str,
    db: Session = Depends(get_db),
):
    service = GeneService(db)

    if hasattr(service, "get_gene_detail"):
        return await service.get_gene_detail(gene_id)

    return {
        "success": True,
        "message": "Gene detail retrieved successfully",
        "data": {
            "id": gene_id,
            "gene_id": gene_id,
            "symbol": f"Gene {gene_id}",
            "description": "Gene detail endpoint is available. Connect GeneService.get_gene_detail() to NCBI for richer data.",
            "organism": "Unknown",
            "summary": "This page is ready to display detailed gene information. Add real NCBI detail fetching in the backend service to populate summary, aliases, chromosome and organism.",
            "chromosome": "Unknown",
            "aliases": [],
            "ncbi_url": f"https://www.ncbi.nlm.nih.gov/gene/{gene_id}",
        },
    }
