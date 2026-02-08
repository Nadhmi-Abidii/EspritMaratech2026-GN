import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
  ApexLegend,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { MaterialModule } from 'src/app/material.module';
import {
  FinancialSummary,
  PublicReportItem,
  PublicReportsPayload,
  PublicReportType,
} from 'src/app/core/models/public.models';
import { extractApiErrorMessage } from 'src/app/core/utils/api-error.util';
import { PublicService } from 'src/app/features/public/services/public.service';

type DonutChartOptions = {
  series: number[];
  chart: ApexChart;
  labels: string[];
  legend: ApexLegend;
  dataLabels: ApexDataLabels;
  colors: string[];
  plotOptions: ApexPlotOptions;
  tooltip: ApexTooltip;
  stroke: ApexStroke;
};

type BarChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  colors: string[];
  dataLabels: ApexDataLabels;
  plotOptions: ApexPlotOptions;
  grid: ApexGrid;
  tooltip: ApexTooltip;
  legend: ApexLegend;
};

interface SummaryCard {
  label: string;
  value: number;
  icon: string;
}

@Component({
  selector: 'app-public-reports',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, MaterialModule, NgApexchartsModule],
  templateUrl: './public-reports.component.html',
  styleUrl: './public-reports.component.scss',
})
export class PublicReportsComponent implements OnInit {
  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    type: ['all'],
    year: ['all'],
  });

  reports: PublicReportItem[] = [];
  private allReports: PublicReportItem[] = [];

  availableTypes: PublicReportType[] = [];
  availableYears: number[] = [];

  financialSummary: FinancialSummary | null = null;
  financialTimeline: PublicReportsPayload['financialTimeline'] = [];
  impactSummary: PublicReportsPayload['summary'] | null = null;
  familiesByZone: PublicReportsPayload['familiesByZone'] = [];

  generatedAt = '';
  loading = false;
  errorMessage = '';

  financialBreakdownChart: DonutChartOptions = this.createEmptyDonutChart();
  donationTimelineChart: BarChartOptions = this.createEmptyDonationChart();
  familiesByZoneChart: BarChartOptions = this.createEmptyFamiliesChart();

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly fb: FormBuilder,
    private readonly publicService: PublicService
  ) {}

  ngOnInit(): void {
    this.filtersForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.applyLocalFilters();
    });

    this.loadReports();
  }

  get totalReports(): number {
    return this.reports.length;
  }

  get summaryCards(): SummaryCard[] {
    if (!this.impactSummary) {
      return [];
    }

    return [
      {
        label: 'Familles aidees',
        value: this.impactSummary.familiesHelped,
        icon: 'groups',
      },
      {
        label: 'Beneficiaires accompagnes',
        value: this.impactSummary.beneficiariesSupported,
        icon: 'diversity_3',
      },
      {
        label: 'Visites effectuees',
        value: this.impactSummary.visitsCompleted,
        icon: 'event_available',
      },
      {
        label: "Unites d'aide distribuees",
        value: this.impactSummary.aidUnitsDistributed,
        icon: 'volunteer_activism',
      },
    ];
  }

  resetFilters(): void {
    this.filtersForm.reset({
      search: '',
      type: 'all',
      year: 'all',
    });
  }

  formatReportType(type: PublicReportType): string {
    if (type === 'annual') {
      return 'Annuel';
    }

    if (type === 'impact') {
      return 'Impact';
    }

    return 'Financier';
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('fr-FR').format(value);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: this.financialSummary?.currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private loadReports(): void {
    this.loading = true;
    this.errorMessage = '';

    this.publicService
      .getReports()
      .pipe(
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, 'Impossible de charger les rapports publics.');
          return EMPTY;
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((payload) => {
        this.bindPayload(payload);
      });
  }

  private bindPayload(payload: PublicReportsPayload): void {
    this.allReports = payload.reports;
    this.availableTypes = payload.availableTypes;
    this.availableYears = payload.availableYears;

    this.financialSummary = payload.financialSummary;
    this.financialTimeline = payload.financialTimeline;
    this.impactSummary = payload.summary;
    this.familiesByZone = payload.familiesByZone;
    this.generatedAt = payload.generatedAt;

    this.financialBreakdownChart = this.buildFinancialChart(payload.financialSummary);
    this.donationTimelineChart = this.buildDonationTimelineChart(payload.financialTimeline);
    this.familiesByZoneChart = this.buildFamiliesByZoneChart(payload.familiesByZone);

    this.applyLocalFilters();
  }

  private applyLocalFilters(): void {
    const searchTerm = this.filtersForm.controls.search.value.trim().toLowerCase();
    const typeFilter = this.filtersForm.controls.type.value;
    const yearFilterRaw = this.filtersForm.controls.year.value;
    const yearFilter = yearFilterRaw === 'all' ? null : Number(yearFilterRaw);

    this.reports = this.allReports.filter((report) => {
      if (typeFilter !== 'all' && report.type !== typeFilter) {
        return false;
      }

      if (yearFilter !== null && report.year !== yearFilter) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      const haystack = [report.title, report.summary, report.type, ...report.highlights]
        .join(' ')
        .toLowerCase();

      return haystack.includes(searchTerm);
    });
  }

  private buildFinancialChart(summary: FinancialSummary): DonutChartOptions {
    if (!summary.breakdown.length) {
      return this.createEmptyDonutChart();
    }

    return {
      series: summary.breakdown.map((item) => item.percentage),
      labels: summary.breakdown.map((item) => item.label),
      chart: {
        type: 'donut',
        height: 330,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
      legend: {
        position: 'bottom',
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        width: 0,
      },
      plotOptions: {
        pie: {
          donut: {
            size: '68%',
          },
        },
      },
      tooltip: {
        theme: 'dark',
      },
      colors: ['#0f766e', '#0c4a6e', '#b45309'],
    };
  }

  private buildDonationTimelineChart(
    timeline: PublicReportsPayload['financialTimeline']
  ): BarChartOptions {
    if (!timeline.length) {
      return this.createEmptyDonationChart();
    }

    const ordered = [...timeline].sort((first, second) => first.year - second.year);

    return {
      series: [
        {
          name: 'Dons estimes',
          data: ordered.map((item) => item.donationEstimate),
        },
        {
          name: 'Depenses estimees',
          data: ordered.map((item) => item.spentEstimate),
        },
      ],
      chart: {
        type: 'bar',
        height: 330,
        toolbar: {
          show: false,
        },
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
      plotOptions: {
        bar: {
          borderRadius: 6,
          columnWidth: '46%',
        },
      },
      dataLabels: {
        enabled: false,
      },
      colors: ['#0c4a6e', '#0f766e'],
      grid: {
        borderColor: '#d6dde8',
        strokeDashArray: 3,
      },
      xaxis: {
        categories: ordered.map((item) => String(item.year)),
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
      },
      legend: {
        show: true,
        position: 'top',
      },
      tooltip: {
        theme: 'dark',
      },
    };
  }

  private buildFamiliesByZoneChart(
    familiesByZone: PublicReportsPayload['familiesByZone']
  ): BarChartOptions {
    const ordered = [...familiesByZone]
      .sort((first, second) => second.totalFamilies - first.totalFamilies)
      .slice(0, 8);

    if (!ordered.length) {
      return this.createEmptyFamiliesChart();
    }

    return {
      series: [
        {
          name: 'Familles',
          data: ordered.map((item) => item.totalFamilies),
        },
      ],
      chart: {
        type: 'bar',
        height: 330,
        toolbar: {
          show: false,
        },
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
      plotOptions: {
        bar: {
          borderRadius: 7,
          horizontal: true,
          barHeight: '55%',
        },
      },
      dataLabels: {
        enabled: false,
      },
      colors: ['#0c4a6e'],
      grid: {
        borderColor: '#d6dde8',
        strokeDashArray: 3,
      },
      xaxis: {
        categories: ordered.map((item) => item.zone),
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
      },
      legend: {
        show: false,
      },
      tooltip: {
        theme: 'dark',
      },
    };
  }

  private createEmptyDonutChart(): DonutChartOptions {
    return {
      series: [1],
      labels: ['Aucune donnee pour le moment'],
      chart: {
        type: 'donut',
        height: 330,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
      legend: {
        position: 'bottom',
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        width: 0,
      },
      plotOptions: {
        pie: {
          donut: {
            size: '68%',
          },
        },
      },
      tooltip: {
        theme: 'dark',
      },
      colors: ['#cbd5e1'],
    };
  }

  private createEmptyDonationChart(): BarChartOptions {
    return {
      series: [
        {
          name: 'Dons estimes',
          data: [0],
        },
        {
          name: 'Depenses estimees',
          data: [0],
        },
      ],
      chart: {
        type: 'bar',
        height: 330,
        toolbar: {
          show: false,
        },
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
      plotOptions: {
        bar: {
          borderRadius: 6,
          columnWidth: '46%',
        },
      },
      dataLabels: {
        enabled: false,
      },
      colors: ['#cbd5e1', '#94a3b8'],
      grid: {
        borderColor: '#d6dde8',
        strokeDashArray: 3,
      },
      xaxis: {
        categories: ['Aucune donnee'],
      },
      yaxis: {
        min: 0,
      },
      legend: {
        show: true,
        position: 'top',
      },
      tooltip: {
        theme: 'dark',
      },
    };
  }

  private createEmptyFamiliesChart(): BarChartOptions {
    return {
      series: [
        {
          name: 'Familles',
          data: [0],
        },
      ],
      chart: {
        type: 'bar',
        height: 330,
        toolbar: {
          show: false,
        },
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
      plotOptions: {
        bar: {
          borderRadius: 7,
          horizontal: true,
          barHeight: '55%',
        },
      },
      dataLabels: {
        enabled: false,
      },
      colors: ['#cbd5e1'],
      grid: {
        borderColor: '#d6dde8',
        strokeDashArray: 3,
      },
      xaxis: {
        categories: ['Aucune donnee'],
      },
      yaxis: {
        min: 0,
      },
      legend: {
        show: false,
      },
      tooltip: {
        theme: 'dark',
      },
    };
  }
}
