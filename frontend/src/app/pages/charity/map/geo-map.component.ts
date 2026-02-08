import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Famille, Geolocation, Visite } from 'src/app/core/models/charity.models';

type LeafletModule = typeof import('leaflet');

@Component({
  selector: 'app-geo-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './geo-map.component.html',
  styleUrl: './geo-map.component.scss',
})
export class GeoMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() families: Famille[] = [];
  @Input() visits: Visite[] = [];
  @Input() height = '360px';
  @Input() selectable = false;
  @Input() selectedPoint: Geolocation | null = null;
  @Output() readonly pointSelected = new EventEmitter<Geolocation>();

  @ViewChild('mapHost', { static: true })
  private mapHost?: ElementRef<HTMLDivElement>;

  hasPoints = false;

  private leaflet?: LeafletModule;
  private map?: import('leaflet').Map;
  private markerLayer?: import('leaflet').LayerGroup;
  private selectionMarker?: import('leaflet').CircleMarker;

  async ngAfterViewInit(): Promise<void> {
    if (!this.mapHost || typeof window === 'undefined') {
      return;
    }

    this.leaflet = await import('leaflet');
    const L = this.leaflet;

    this.map = L.map(this.mapHost.nativeElement, {
      center: [36.8065, 10.1815],
      zoom: 7,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.markerLayer = L.layerGroup().addTo(this.map);
    this.map.on('click', (event) => {
      if (!this.selectable) {
        return;
      }

      const point = {
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      };

      this.updateSelectionMarker(point, true);
    });

    this.renderMarkers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.renderMarkers();

    if (changes['selectedPoint']) {
      this.updateSelectionMarker(this.selectedPoint ?? null);
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private renderMarkers(): void {
    if (!this.map || !this.leaflet || !this.markerLayer) {
      return;
    }

    const L = this.leaflet;
    this.markerLayer.clearLayers();

    const bounds: Array<[number, number]> = [];

    for (const family of this.families) {
      const geo = family.geolocation;

      if (!geo) {
        continue;
      }

      const marker = L.circleMarker([geo.latitude, geo.longitude], {
        radius: 7,
        color: '#1976d2',
        fillColor: '#1976d2',
        fillOpacity: 0.7,
      }).bindPopup(this.familyPopupContent(family));

      marker.addTo(this.markerLayer);
      bounds.push([geo.latitude, geo.longitude]);
    }

    for (const visit of this.visits) {
      const geo = visit.geolocation;

      if (!geo) {
        continue;
      }

      const marker = L.circleMarker([geo.latitude, geo.longitude], {
        radius: 6,
        color: '#2e7d32',
        fillColor: '#43a047',
        fillOpacity: 0.75,
      }).bindPopup(
        `<strong>Visite :</strong> ${new Date(visit.visitDate).toLocaleString('fr-FR')}`
      );

      marker.addTo(this.markerLayer);
      bounds.push([geo.latitude, geo.longitude]);
    }

    this.updateSelectionMarker(this.selectedPoint ?? null);

    if (this.selectedPoint) {
      bounds.push([this.selectedPoint.latitude, this.selectedPoint.longitude]);
    }

    this.hasPoints = bounds.length > 0;

    if (!this.hasPoints) {
      this.map.setView([36.8065, 10.1815], 7);
      return;
    }

    const latLngBounds = L.latLngBounds(bounds.map((point) => L.latLng(point[0], point[1])));
    this.map.fitBounds(latLngBounds.pad(0.2));
  }

  private updateSelectionMarker(point: Geolocation | null, emit = false): void {
    if (!this.map || !this.leaflet) {
      return;
    }

    const L = this.leaflet;

    if (!point) {
      this.selectionMarker?.remove();
      this.selectionMarker = undefined;
      return;
    }

    const latLng: [number, number] = [point.latitude, point.longitude];

    if (!this.selectionMarker) {
      this.selectionMarker = L.circleMarker(latLng, {
        radius: 8,
        color: '#c62828',
        fillColor: '#ef5350',
        fillOpacity: 0.85,
      }).addTo(this.map);
    } else {
      this.selectionMarker.setLatLng(latLng);
    }

    this.selectionMarker.bindPopup(
      `<strong>Point sélectionné</strong><br>${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`
    );

    if (emit) {
      this.pointSelected.emit(point);
    }
  }

  private familyPopupContent(family: Famille): string {
    const birthDate = family.date_de_naissance
      ? new Date(family.date_de_naissance).toLocaleDateString('fr-FR')
      : '-';
    const children = family.nombre_enfants ?? '-';
    const occupation = family.occupation ?? '-';
    const revenue =
      family.revenu_mensuel === undefined || family.revenu_mensuel === null
        ? '-'
        : new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          }).format(family.revenu_mensuel);

    return [
      `<strong>Famille :</strong> ${family.name}`,
      `<strong>Date de naissance :</strong> ${birthDate}`,
      `<strong>Enfants :</strong> ${children}`,
      `<strong>Occupation :</strong> ${occupation}`,
      `<strong>Revenu mensuel :</strong> ${revenue}`,
      `<strong>Logement :</strong> ${this.housingSituationLabel(family.situation_logement)}`,
    ].join('<br>');
  }

  private housingSituationLabel(value?: string): string {
    if (!value) {
      return '-';
    }

    if (value === 'proprietaire') {
      return 'Propriétaire';
    }

    if (value === 'locataire') {
      return 'Locataire';
    }

    if (value === 'heberge') {
      return 'Hébergé';
    }

    if (value === 'sans_logement') {
      return 'Sans logement';
    }

    return 'Autre';
  }
}
