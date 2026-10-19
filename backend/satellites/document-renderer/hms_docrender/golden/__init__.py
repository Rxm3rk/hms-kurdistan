"""The PDF golden-image harness (docs/specs/modules/platform-docs.md §10; the nightly ``golden-image-print`` step).

``python -I -m hms_docrender.golden check --fixtures DIR --goldens DIR --candidates DIR`` renders every ``*.html``
fixture with the satellite's command line (a fresh, hermetic process per fixture), rasterises each page with
pypdfium2 at 150 dpi in 8-bit grey, compares it pixel for pixel with ``<goldens>/<identity-hash>/<fixture>-p<n>.png``,
and decodes every barcode with zxing-cpp against the payloads the fixture declares. It fails closed and writes
candidates, difference images and a manifest; it never writes into the goldens directory. ``approve`` (run only by
a human or the integrator) copies a candidate set into the goldens directory with ``human_script_review: requested``.
See ``harness.py`` for the fixture metadata convention.
"""
