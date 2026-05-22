'use client';

import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PublicOffice } from '@/lib/offices';

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

export function PragueMap({
  offices,
  unlockedIds,
  onOfficeClick,
}: {
  offices: PublicOffice[];
  unlockedIds: string[];
  onOfficeClick: (office: PublicOffice) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{ tile: L.TileLayer | null; pins: L.Marker[]; lines: L.Polyline[] }>({
    tile: null,
    pins: [],
    lines: [],
  });
  const onClickRef = useRef(onOfficeClick);
  useEffect(() => { onClickRef.current = onOfficeClick; }, [onOfficeClick]);
  const overviewRef = useRef<L.LatLngBounds | null>(null);

  // ── Init map once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: [50.062, 14.436],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
      dragging: true,
      zoomSnap: 0.5,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control
      .attribution({ position: 'bottomleft', prefix: false })
      .addAttribution('© OpenStreetMap · © CARTO')
      .addTo(map);

    const tile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    });
    tile.addTo(map);
    layersRef.current.tile = tile;

    mapRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      map.remove();
      mapRef.current = null;
      layersRef.current = { tile: null, pins: [], lines: [] };
    };
  }, []);

  // ── Pins + connecting lines ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const root = containerRef.current;
    if (!map || !root) return;

    layersRef.current.pins.forEach((p) => map.removeLayer(p));
    layersRef.current.lines.forEach((l) => map.removeLayer(l));
    layersRef.current.pins = [];
    layersRef.current.lines = [];

    const allPoints: [number, number][] = [];

    const officePoints = (o: PublicOffice): [number, number][] => [
      o.coords,
      ...o.restaurants.map((r) => r.coords),
    ];

    // JS-driven hover reveal: toggle `is-active` on every element tagged with
    // the hovered office id (rest pins + connection paths). Scales to N offices
    // without per-office CSS. Hovering also flies the map to frame that office
    // and its restaurants; leaving returns to the overview.
    const setActive = (office: PublicOffice, on: boolean) => {
      root
        .querySelectorAll(`[data-office-id="${CSS.escape(office.id)}"]`)
        .forEach((n) => n.classList.toggle('is-active', on));

      if (on) {
        root.setAttribute('data-hover-office', office.id);
        try {
          map.flyToBounds(L.latLngBounds(officePoints(office)), {
            paddingTopLeft: [60, 220],
            paddingBottomRight: [60, 160],
            maxZoom: 16.5,
            duration: 0.7,
          });
        } catch {
          /* noop */
        }
      } else if (root.getAttribute('data-hover-office') === office.id) {
        root.removeAttribute('data-hover-office');
        if (overviewRef.current) {
          map.flyToBounds(overviewRef.current, {
            paddingTopLeft: [40, 200],
            paddingBottomRight: [40, 120],
            maxZoom: 16,
            duration: 0.7,
          });
        }
      }
    };

    for (const office of offices) {
      const isAuthed = unlockedIds.includes(office.id);
      allPoints.push(office.coords);

      const officeHtml = `
        <div class="pin-wrap office-pin-wrap ${isAuthed ? 'is-authed' : ''}" data-office-id="${escapeHtml(office.id)}" role="button" tabindex="0" aria-label="Kancelář ${escapeHtml(office.name)}">
          <span class="pin-pulse" aria-hidden="true"></span>
          <span class="pin-pulse pin-pulse--two" aria-hidden="true"></span>
          <span class="pin-dot pin-dot--office" aria-hidden="true"></span>
          <span class="pin-label pin-label--office">${escapeHtml(office.name)}</span>
        </div>`;
      const marker = L.marker(office.coords, {
        icon: L.divIcon({
          className: 'leaflet-pin-icon',
          html: officeHtml,
          iconSize: [140, 80],
          iconAnchor: [70, 40],
        }),
        riseOnHover: true,
        title: office.name,
        keyboard: true,
      }).addTo(map);
      marker.on('click', () => onClickRef.current?.(office));

      const wireDom = () => {
        const el = marker.getElement();
        if (!el) return;
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClickRef.current?.(office);
          }
        });
        el.addEventListener('mouseenter', () => setActive(office, true));
        el.addEventListener('mouseleave', () => setActive(office, false));
        el.addEventListener('focus', () => setActive(office, true), true);
        el.addEventListener('blur', () => setActive(office, false), true);
      };
      if (marker.getElement()) wireDom();
      else marker.on('add', wireDom);
      layersRef.current.pins.push(marker);

      // Restaurant pins + connecting lines exist regardless of auth — hovering
      // the office reveals where you can go for lunch. The password only gates
      // the menu/voting screen, not the map.
      office.restaurants.forEach((r, i) => {
        allPoints.push(r.coords);
        const rHtml = `
            <div class="pin-wrap rest-pin-wrap" data-office-id="${escapeHtml(office.id)}" style="--pin-i: ${i}">
              <span class="pin-dot pin-dot--rest" aria-hidden="true"></span>
              <span class="pin-label pin-label--rest">${escapeHtml(r.name)}</span>
            </div>`;
        const rm = L.marker(r.coords, {
          icon: L.divIcon({
            className: 'leaflet-pin-icon',
            html: rHtml,
            iconSize: [140, 60],
            iconAnchor: [70, 30],
          }),
          interactive: false,
        }).addTo(map);
        layersRef.current.pins.push(rm);

        const line = L.polyline([office.coords, r.coords], {
          weight: 3,
          opacity: 1,
          dashArray: '10,7',
          className: `connection-line connection-line--${i}`,
          interactive: false,
        }).addTo(map);
        const pathEl = line.getElement() as SVGPathElement | null;
        if (pathEl) {
          pathEl.style.setProperty('--line-i', String(i));
          pathEl.setAttribute('data-office-id', office.id);
        }
        layersRef.current.lines.push(line);
      });
    }

    overviewRef.current = allPoints.length > 0 ? L.latLngBounds(allPoints) : null;

    if (allPoints.length > 1) {
      try {
        map.fitBounds(L.latLngBounds(allPoints), {
          animate: true,
          duration: 0.6,
          maxZoom: 16,
          paddingTopLeft: [40, 200],
          paddingBottomRight: [40, 120],
        });
      } catch {
        /* noop */
      }
    } else if (allPoints.length === 1) {
      map.flyTo(allPoints[0], 15.5, { duration: 0.6 });
    }
  }, [offices, unlockedIds]);

  return <div ref={containerRef} className="map-canvas" />;
}
