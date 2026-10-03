"""Tiny procedural mesh helper.

Everything except the dragon boss (and, now, the sun) is built from simple
primitives generated at runtime, so the project needs no extra texture
assets for its environment and stays light on a Raspberry Pi 4. All shapes
here use flat vertex color (no UVs/textures) and are meant to be cheap to
build many of.
"""

import math
import random

from panda3d.core import (
    GeomVertexFormat, GeomVertexData, GeomVertexWriter,
    Geom, GeomTriangles, GeomNode, NodePath, Vec3,
)


def make_box(sx, sy, sz, color=(1, 1, 1, 1)):
    """Return a NodePath containing a single axis-aligned box of size
    (sx, sy, sz) centered on the origin, with a flat color per vertex.
    """
    hx, hy, hz = sx / 2.0, sy / 2.0, sz / 2.0

    fmt = GeomVertexFormat.getV3n3c4()
    vdata = GeomVertexData("box", fmt, Geom.UHStatic)
    vdata.setNumRows(24)

    vertex = GeomVertexWriter(vdata, "vertex")
    normal = GeomVertexWriter(vdata, "normal")
    color_w = GeomVertexWriter(vdata, "color")

    # (face normal, 4 corners in winding order)
    faces = [
        ((0, 0, 1),  [(-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]),
        ((0, 0, -1), [(-hx, hy, -hz), (hx, hy, -hz), (hx, -hy, -hz), (-hx, -hy, -hz)]),
        ((0, 1, 0),  [(-hx, hy, -hz), (-hx, hy, hz), (hx, hy, hz), (hx, hy, -hz)]),
        ((0, -1, 0), [(hx, -hy, -hz), (hx, -hy, hz), (-hx, -hy, hz), (-hx, -hy, -hz)]),
        ((1, 0, 0),  [(hx, -hy, -hz), (hx, hy, -hz), (hx, hy, hz), (hx, -hy, hz)]),
        ((-1, 0, 0), [(-hx, -hy, hz), (-hx, hy, hz), (-hx, hy, -hz), (-hx, -hy, -hz)]),
    ]

    tris = GeomTriangles(Geom.UHStatic)
    vi = 0
    for n, corners in faces:
        for c in corners:
            vertex.addData3(*c)
            normal.addData3(*n)
            color_w.addData4(*color)
        tris.addVertices(vi, vi + 1, vi + 2)
        tris.addVertices(vi, vi + 2, vi + 3)
        vi += 4

    geom = Geom(vdata)
    geom.addPrimitive(tris)
    node = GeomNode("box")
    node.addGeom(geom)
    return NodePath(node)


def make_sphere(radius, color=(1, 1, 1, 1), lat_segments=10, lon_segments=14):
    """Return a NodePath containing a procedural UV sphere of the given
    radius, centered on the origin, with a flat color per vertex. Used for
    the dodgeable projectiles (previously boxes/"cubes").
    """
    fmt = GeomVertexFormat.getV3n3c4()
    vdata = GeomVertexData("sphere", fmt, Geom.UHStatic)
    vertex = GeomVertexWriter(vdata, "vertex")
    normal = GeomVertexWriter(vdata, "normal")
    color_w = GeomVertexWriter(vdata, "color")

    verts_per_row = lon_segments + 1
    for i in range(lat_segments + 1):
        theta = math.pi * i / lat_segments  # 0 (top) .. pi (bottom)
        sin_t = math.sin(theta)
        cos_t = math.cos(theta)
        for j in range(verts_per_row):
            phi = 2.0 * math.pi * j / lon_segments
            x = radius * sin_t * math.cos(phi)
            y = radius * sin_t * math.sin(phi)
            z = radius * cos_t
            vertex.addData3(x, y, z)
            n = Vec3(x, y, z)
            if n.length() > 0.0001:
                n.normalize()
            normal.addData3(n)
            color_w.addData4(*color)

    tris = GeomTriangles(Geom.UHStatic)
    for i in range(lat_segments):
        for j in range(lon_segments):
            a = i * verts_per_row + j
            b = a + verts_per_row
            tris.addVertices(a, b, a + 1)
            tris.addVertices(a + 1, b, b + 1)

    geom = Geom(vdata)
    geom.addPrimitive(tris)
    node = GeomNode("sphere")
    node.addGeom(geom)
    return NodePath(node)


def make_cone(base_radius, top_radius, height, color=(1, 1, 1, 1), segments=14):
    """Return a NodePath containing a procedural cone/frustum sitting with
    its base centered at the local origin, pointing up +Z. Used for the
    volcano - top_radius > 0 gives a crater mouth instead of a sharp peak.
    """
    fmt = GeomVertexFormat.getV3n3c4()
    vdata = GeomVertexData("cone", fmt, Geom.UHStatic)
    vertex = GeomVertexWriter(vdata, "vertex")
    normal = GeomVertexWriter(vdata, "normal")
    color_w = GeomVertexWriter(vdata, "color")

    tris = GeomTriangles(Geom.UHStatic)
    slope_len = math.hypot(base_radius - top_radius, height)
    ny = height / slope_len if slope_len > 0 else 1.0
    nxy = (base_radius - top_radius) / slope_len if slope_len > 0 else 0.0

    vi = 0
    for i in range(segments):
        a0 = 2.0 * math.pi * i / segments
        a1 = 2.0 * math.pi * (i + 1) / segments
        bx0, bz0 = base_radius * math.cos(a0), base_radius * math.sin(a0)
        bx1, bz1 = base_radius * math.cos(a1), base_radius * math.sin(a1)
        tx0, tz0 = top_radius * math.cos(a0), top_radius * math.sin(a0)
        tx1, tz1 = top_radius * math.cos(a1), top_radius * math.sin(a1)

        n0 = (math.cos(a0) * ny, math.sin(a0) * ny, nxy)
        n1 = (math.cos(a1) * ny, math.sin(a1) * ny, nxy)

        for (x, y, z), n in (
            ((bx0, bz0, 0.0), n0), ((bx1, bz1, 0.0), n1),
            ((tx1, tz1, height), n1), ((tx0, tz0, height), n0),
        ):
            vertex.addData3(x, y, z)
            normal.addData3(*n)
            color_w.addData4(*color)
        tris.addVertices(vi, vi + 1, vi + 2)
        tris.addVertices(vi, vi + 2, vi + 3)
        vi += 4

    geom = Geom(vdata)
    geom.addPrimitive(tris)
    node = GeomNode("cone")
    node.addGeom(geom)
    return NodePath(node)


def make_disc(radius, color=(1, 1, 1, 1), segments=14):
    """A flat disc in the XY plane, facing +Z - handy for a lava-pool /
    crater-glow decal sitting flush on top of a cone.
    """
    fmt = GeomVertexFormat.getV3n3c4()
    vdata = GeomVertexData("disc", fmt, Geom.UHStatic)
    vertex = GeomVertexWriter(vdata, "vertex")
    normal = GeomVertexWriter(vdata, "normal")
    color_w = GeomVertexWriter(vdata, "color")

    vertex.addData3(0, 0, 0)
    normal.addData3(0, 0, 1)
    color_w.addData4(*color)
    for i in range(segments + 1):
        a = 2.0 * math.pi * i / segments
        vertex.addData3(radius * math.cos(a), radius * math.sin(a), 0)
        normal.addData3(0, 0, 1)
        color_w.addData4(*color)

    tris = GeomTriangles(Geom.UHStatic)
    for i in range(1, segments + 1):
        tris.addVertices(0, i, i + 1)

    geom = Geom(vdata)
    geom.addPrimitive(tris)
    node = GeomNode("disc")
    node.addGeom(geom)
    return NodePath(node)


def make_volcano(base_radius, height, crater_radius, segments=20, rings=6,
                  jitter=0.22, seed=None,
                  dark_color=(0.10, 0.075, 0.065, 1.0),
                  light_color=(0.30, 0.22, 0.17, 1.0),
                  crater_color=(0.10, 0.04, 0.03, 1.0)):
    """Return a NodePath containing a procedural volcanic mountain.

    Unlike a plain make_cone(), this stacks several radius-jittered rings
    on top of each other (using a few fixed sine terms so the bumps line
    up into continuous ridges/gullies instead of per-vertex static),
    tapering up to an irregular crater bowl rather than a sharp point or a
    perfect circular hole. Faces are flat-shaded (one normal/color per
    face, like make_box), which reads as chunky, rocky facets rather than
    a smooth dome - a good match for "geological" rock.

    `seed` gives a repeatable-but-different shape per instance, so several
    volcanoes placed in a scene don't look like copy-pasted clones. Purely
    vertex-colored, like the rest of this module - no textures, so it's
    cheap to place a few of these.
    """
    rng = random.Random(seed)

    # A handful of fixed sine terms, reused at every ring (with a small
    # per-ring angular twist), so the surface bumps form continuous
    # ridges running down the slope instead of looking like noise.
    noise_terms = [
        (rng.uniform(2, 3), rng.uniform(0, 2 * math.pi), 1.0),
        (rng.uniform(3, 5), rng.uniform(0, 2 * math.pi), 0.6),
        (rng.uniform(5, 9), rng.uniform(0, 2 * math.pi), 0.35),
    ]
    weight_sum = sum(w for _, _, w in noise_terms)

    def ridge_noise(angle, ring_index):
        twist = ring_index * 0.12
        n = 0.0
        for freq, phase, amp in noise_terms:
            n += math.sin(angle * freq + phase + twist) * amp
        return n / weight_sum

    # ---- ring rows: outer slope (base -> crater rim), then the crater
    # bowl (rim -> a small dark floor) ----
    rows = []  # list of (points, rgba) per ring
    for r in range(rings + 1):
        t = r / rings
        ring_radius = base_radius * (1.0 - t) + crater_radius * t
        rough_scale = jitter * (1.0 - 0.35 * t)  # calmer near the rim
        z = height * t
        if 0 < r < rings:
            z += rng.uniform(-0.05, 0.05) * height  # uneven terrace heights
        pts = []
        for s in range(segments):
            angle = 2.0 * math.pi * s / segments
            rough = 1.0 + ridge_noise(angle, r) * rough_scale
            radius = max(0.2, ring_radius * rough)
            pts.append((radius * math.cos(angle), radius * math.sin(angle), z))
        tint = rng.uniform(-0.035, 0.035)
        rgba = tuple(
            min(1.0, max(0.0, dark_color[i] * (1 - t) + light_color[i] * t + tint))
            for i in range(3)
        ) + (1.0,)
        rows.append((pts, rgba))

    bowl_rings = 3
    crater_top_z = height
    for r in range(1, bowl_rings + 1):
        t = r / bowl_rings
        ring_radius = crater_radius * (1.0 - t) + (crater_radius * 0.15) * t
        z = crater_top_z - crater_radius * 0.9 * t
        pts = []
        for s in range(segments):
            angle = 2.0 * math.pi * s / segments
            rough = 1.0 + ridge_noise(angle + 2.4, rings + r) * jitter * 0.5
            radius = max(0.1, ring_radius * rough)
            pts.append((radius * math.cos(angle), radius * math.sin(angle), z))
        rows.append((pts, crater_color))

    # ---- turn the rows into a flat-shaded mesh (same per-face-normal
    # convention as make_box/make_cone above) ----
    fmt = GeomVertexFormat.getV3n3c4()
    vdata = GeomVertexData("volcano", fmt, Geom.UHStatic)
    vertex = GeomVertexWriter(vdata, "vertex")
    normal = GeomVertexWriter(vdata, "normal")
    color_w = GeomVertexWriter(vdata, "color")
    tris = GeomTriangles(Geom.UHStatic)

    vi = 0
    for ri in range(len(rows) - 1):
        pts0, col0 = rows[ri]
        pts1, col1 = rows[ri + 1]
        face_color = tuple((col0[i] + col1[i]) * 0.5 for i in range(4))
        for s in range(segments):
            s1 = (s + 1) % segments
            p0 = Vec3(*pts0[s])
            p1 = Vec3(*pts0[s1])
            p2 = Vec3(*pts1[s1])
            p3 = Vec3(*pts1[s])
            n = (p1 - p0).cross(p2 - p0)
            if n.length() > 1e-6:
                n.normalize()
            else:
                n = Vec3(p0.x, p0.y, 0.3)
                n.normalize()
            for p in (p0, p1, p2, p3):
                vertex.addData3(p.x, p.y, p.z)
                normal.addData3(n.x, n.y, n.z)
                color_w.addData4(*face_color)
            tris.addVertices(vi, vi + 1, vi + 2)
            tris.addVertices(vi, vi + 2, vi + 3)
            vi += 4

    # Cap the crater floor with a small fan so it reads as a dark hollow
    # rather than a hole punched through the mountain.
    floor_pts, _ = rows[-1]
    cx = sum(p[0] for p in floor_pts) / len(floor_pts)
    cy = sum(p[1] for p in floor_pts) / len(floor_pts)
    cz = sum(p[2] for p in floor_pts) / len(floor_pts)
    center_i = vi
    vertex.addData3(cx, cy, cz)
    normal.addData3(0, 0, 1)
    color_w.addData4(*crater_color)
    for p in floor_pts:
        vertex.addData3(*p)
        normal.addData3(0, 0, 1)
        color_w.addData4(*crater_color)
    for s in range(segments):
        s1 = (s + 1) % segments
        tris.addVertices(center_i, center_i + 1 + s, center_i + 1 + s1)

    geom = Geom(vdata)
    geom.addPrimitive(tris)
    node = GeomNode("volcano")
    node.addGeom(geom)
    return NodePath(node)


def make_sky_dome(radius, zenith_color, horizon_color, ground_color=None,
                   lat_segments=16, lon_segments=24):
    """Return a large inward-facing sphere with a vertical color gradient:
    `zenith_color` straight up, fading to `horizon_color` at the equator,
    and (mostly out of view) `ground_color` below that.

    This gives a simple gradient sky with no HDRI/texture assets needed -
    reparent it to render, then call setLightOff()/setFogOff(),
    setTwoSided(True), setDepthWrite(False) and setBin("background", 0)
    on it so it always draws behind everything else at effectively
    infinite distance, unaffected by scene lighting or fog.
    """
    if ground_color is None:
        ground_color = horizon_color

    def lerp_rgba(a, b, t):
        return tuple(a[i] + (b[i] - a[i]) * t for i in range(4))

    fmt = GeomVertexFormat.getV3n3c4()
    vdata = GeomVertexData("sky", fmt, Geom.UHStatic)
    vertex = GeomVertexWriter(vdata, "vertex")
    normal = GeomVertexWriter(vdata, "normal")
    color_w = GeomVertexWriter(vdata, "color")

    verts_per_row = lon_segments + 1
    for i in range(lat_segments + 1):
        theta = math.pi * i / lat_segments  # 0 = straight up, pi = straight down
        sin_t = math.sin(theta)
        cos_t = math.cos(theta)
        if cos_t >= 0.0:
            col = lerp_rgba(zenith_color, horizon_color, 1.0 - cos_t)
        else:
            col = lerp_rgba(horizon_color, ground_color, min(1.0, -cos_t * 1.5))
        for j in range(verts_per_row):
            phi = 2.0 * math.pi * j / lon_segments
            x = radius * sin_t * math.cos(phi)
            y = radius * sin_t * math.sin(phi)
            z = radius * cos_t
            vertex.addData3(x, y, z)
            n = Vec3(-x, -y, -z)  # inward-facing, since the camera sits inside
            if n.length() > 0.0001:
                n.normalize()
            normal.addData3(n.x, n.y, n.z)
            color_w.addData4(*col)

    tris = GeomTriangles(Geom.UHStatic)
    for i in range(lat_segments):
        for j in range(lon_segments):
            a = i * verts_per_row + j
            b = a + verts_per_row
            # Reversed winding relative to make_sphere() above, so the
            # front faces point inward.
            tris.addVertices(a, a + 1, b)
            tris.addVertices(a + 1, b + 1, b)

    geom = Geom(vdata)
    geom.addPrimitive(tris)
    node = GeomNode("sky_dome")
    node.addGeom(geom)
    return NodePath(node)


def make_ridge(width, base_z, peak_height_min, peak_height_max,
               segments=14, seed=None, color=(0.55, 0.60, 0.68, 1.0)):
    """Return a thin, flat vertical strip with a jagged upper edge - a
    cheap distant-mountain-range silhouette for background depth layers.
    Not a full 3D mountain (just a "fin" facing the camera), so it's very
    cheap to add a couple of these behind the real volcano/decor. Call
    setTwoSided(True) on the result since it's only one polygon thick.
    """
    rng = random.Random(seed)
    heights = [rng.uniform(peak_height_min, peak_height_max)
               for _ in range(segments + 1)]
    for _ in range(2):  # light smoothing so it's rolling, not spiky noise
        heights = [
            (heights[max(0, i - 1)] + heights[i] + heights[min(segments, i + 1)]) / 3.0
            for i in range(segments + 1)
        ]

    fmt = GeomVertexFormat.getV3n3c4()
    vdata = GeomVertexData("ridge", fmt, Geom.UHStatic)
    vertex = GeomVertexWriter(vdata, "vertex")
    normal = GeomVertexWriter(vdata, "normal")
    color_w = GeomVertexWriter(vdata, "color")

    half_w = width / 2.0
    for i in range(segments + 1):
        x = -half_w + width * i / segments
        vertex.addData3(x, 0, base_z)
        normal.addData3(0, -1, 0)
        color_w.addData4(*color)
        vertex.addData3(x, 0, base_z + heights[i])
        normal.addData3(0, -1, 0)
        color_w.addData4(*color)

    tris = GeomTriangles(Geom.UHStatic)
    for i in range(segments):
        b0, t0 = i * 2, i * 2 + 1
        b1, t1 = (i + 1) * 2, (i + 1) * 2 + 1
        tris.addVertices(b0, b1, t1)
        tris.addVertices(b0, t1, t0)

    geom = Geom(vdata)
    geom.addPrimitive(tris)
    node = GeomNode("ridge")
    node.addGeom(geom)
    return NodePath(node)
