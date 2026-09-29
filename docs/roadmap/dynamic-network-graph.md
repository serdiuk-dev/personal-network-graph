# Dynamic Network Graph — accepted scope

Recorded: 2026-09-28. Reference: user-supplied graph_view.mp4 (about 33 seconds).
Status: accepted backlog; implementation starts after owner authentication is
released and verified. Proposed sequence: v0.42.0 interaction/layout, v0.43.0
contact imagery. Version numbers remain provisional until v0.41.0 closes.

## Reference and interpretation

The video shows a graph with draggable circular nodes, attached links that follow
the movement, zoom/pan, circular contact photos and relaxation after movement.
It does not establish a guarantee of returning to identical original coordinates.
That return is an explicit additional user requirement for this project.
"Я at the bottom" means behind other nodes in paint order, not at the bottom of
the screen. Keep Я at the radial centre; it remains a virtual/system node, not a
Person and not an extra account or analytics record.

## Accepted visual/interaction requirements

1. Every real contact can be dragged for temporary exploration. Connected straight
   or curved links follow the endpoints continuously, retaining their existing
   colour, width and relationship meaning. Moving a node never edits relationships.
   Direct line-handle editing is not implied; dragging a connection can be explored
   later if the node-based interaction does not satisfy the review.
2. Normal paint order, back to front: Я -> INNER -> MIDDLE -> OUTER. Names follow
   the same visual priority. Within each circle use stable deterministic ordering;
   newer contacts paint above older contacts when creation order is available.
   Selection/hover must not make Я cover contacts again. Preserve picking accuracy.
3. Separate circle membership from render depth and temporary drag position.
   Dragging must not silently change a contact's networkCircle or importance.
4. Reduce overlaps for both node disks and name/tag bounding boxes, accounting
   for current zoom, avatar size and long names. When the viewport is too dense,
   spread the layout and prioritize readable labels, with full text available on
   focus/selection. Do not promise zero intersections for an arbitrary dense graph.
5. Retain a stable rest layout and a temporary interaction state. While the pointer
   is held, the dragged node follows it and neighbours yield gently. After release,
   keep the inspection view while the pointer remains over the active graph;
   pointer leave with no drag, Escape/Restore layout, or successful relationship
   save triggers a smooth return. Touch release uses a short idle delay plus an
   explicit Restore layout action. Never trigger return mid-drag or mid-form edit.
6. With unchanged data, return to the same collision-adjusted rest coordinates;
   after a relationship/contact change, derive a new deterministic rest layout,
   retaining nearby positions where possible. Edges use the same animated endpoint
   coordinates, with no teleporting or accumulated drift.
7. In People, choose a bundled icon or upload/replace/remove a contact photo.
   Example: Любимая can display her photo inside the circle. Keep ring styling,
   selection outline and a fallback icon/initials on missing or invalid imagery.

## Current code findings

- NetworkGraph.tsx uses Sigma 3, Graphology, @sigma/edge-curve and
  buildRadialPositions. The graph currently builds stable radial coordinates.
- installProdigyVisualLayer appends hubLayer at the end of the container DOM;
  the Я node reducer also sets highlighted=true and zIndex=4. Correct both paths.
- Sigma 3 draws nodes, labels and hovered nodes on separate layers. Numeric zIndex
  alone cannot guarantee ordering across DOM/Canvas/WebGL layers or all image
  programs. Prototype occlusion and picking before settling the renderer changes.
- forceLabel is currently enabled for contacts. Replace unconditional labels with
  measured collision-aware labels, preserving keyboard/selected-contact access.

## Implementation approach

Keep the existing Sigma 3 + Graphology stack; no Sigma 4 migration in this scope.

A. Extract rest-layout generation, layer policy and interaction lifecycle from
   NetworkGraph.tsx into focused WEB modules. First fix Я layering and depth tests.
B. Prototype d3-force as the position solver: forceCollide for disk separation,
   forceX/forceY anchors to rest positions, bounded link forces and damping.
   Use one solver per active graph, batch Graphology coordinate updates and stop
   when settled/unmounted/hidden. Existing ForceAtlas2 must not run concurrently.
   Add separate measured label collision handling; forceCollide alone is not enough.
C. Use Sigma 3 node/captor events and viewportToGraph conversion for drag. Distinguish
   click from drag, suspend camera panning only during node drag, handle pointer
   cancellation and avoid camera auto-rescaling during motion. Test touch separately.
D. On return, use cancellable eased interpolation to saved rest coordinates for
   exact recovery, rather than assuming a force simulation returns to the same spot.
   Honour prefers-reduced-motion and provide an explicit Restore layout control.
E. Evaluate the Sigma-3-compatible @sigma/node-image program with existing curved
   edges, selection/hover and the layer policy. Pin tested compatible package
   versions after inspecting the actual WEB lockfile; do not blindly install latest.

## Private imagery (separate implementation checkpoint)

Use bundled trusted icons first. Contact photo support needs an additive media
reference in Person/API plus private upload, authenticated retrieval and deletion.
Validate file signatures, decoded dimensions and size; re-encode raster thumbnails,
strip metadata and reject SVG/HTML uploads. Do not fetch arbitrary remote URLs.
Use opaque media IDs, controlled storage paths and same-origin authenticated media
requests. Media must be covered by backup/restore and must not become public static
files. Enforce CSRF on uploads/deletes and a route-specific upload limit; do not
raise every API JSON limit for photos. Add a dedicated storage mount without
changing or deleting pnet_db_data. Clear media object URLs/cache on logout.

## Acceptance and delivery

Each milestone: baseline guards -> minimal patch -> Docker Node 24 build/tests ->
review -> controlled deploy -> browser verification -> FF release and annotated tag.
Prisma remains 6.19.3. No Reminder features, social adapters or unrelated cleanup.

Test 360/768/1440 px, long labels, dense fixtures, repeated drag/return, pointer
exit/cancel, touch, filters, selection, zoom/pan, relationship saves and keyboard
navigation. Verify disk/label layering including Я and photo nodes; no drift,
no lost edges, no camera jumps, no stored business-data changes from dragging,
no running simulation after unmount, and bounded performance on a measured dataset.
For media additionally test unauthenticated requests, malformed/oversized files,
replacement/deletion, session loss and backup/restore. Release only after user
visual acceptance against the supplied video and these explicit requirements.

## Primary references

- https://www.sigmajs.org/docs/advanced/layers/
- https://www.sigmajs.org/docs/advanced/data/
- https://www.sigmajs.org/docs/advanced/migration-v2-v3/
- https://www.sigmajs.org/docs/advanced/events/
- https://d3js.org/d3-force/collide
- https://d3js.org/d3-force/position
- https://d3js.org/d3-force/simulation
