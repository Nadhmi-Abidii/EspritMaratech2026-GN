import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, finalize, forkJoin } from 'rxjs';

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
  PublicImpactPayload,
  PublicInfoPayload,
  PublicPostItem,
  PublicReportItem,
  PublicReportType,
  PublicReportsPayload,
} from 'src/app/core/models/public.models';
import { extractApiErrorMessage } from 'src/app/core/utils/api-error.util';
import { PublicService } from 'src/app/features/public/services/public.service';
import { PublicChatbotComponent } from './public-chatbot.component';

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

interface ImpactCard {
  label: string;
  value: number;
  icon: string;
  accent: 'blue' | 'teal' | 'amber' | 'slate';
}

type ProgressTone = 'green' | 'blue' | 'orange';

interface FaqSeedItem {
  id: 'mission' | 'donate' | 'progress' | 'reports' | 'updates' | 'contact';
  question: string;
  tags: string[];
}

interface FaqItemView extends FaqSeedItem {
  answer: string;
}

@Component({
  selector: 'app-public-info',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MaterialModule,
    NgApexchartsModule,
    PublicChatbotComponent
  ],
  templateUrl: './public-info.component.html',
  styleUrls: ['./public-info.component.scss'],
})
export class PublicInfoComponent implements OnInit, AfterViewInit {
  private static hasSeenWelcomeVideoThisSession = false;
  private static readonly welcomeVideoStorageKey = 'omnia.welcomeVideo.seen.v1';

  showWelcomeVideo = false;
  welcomeVideoNeedsUserAction = false;

  readonly donationRib = '3698521477412589633579';

  donationPopupOpen = false;
  private donationPopupPostId: string | null = null;
  donationCheckoutLoading = false;
  donationCheckoutErrorMessage = '';
  readonly donationAmountControl = new FormControl<number | null>(null, {
    validators: [Validators.required, Validators.min(1)],
  });

  info: PublicInfoPayload | null = null;
  impact: PublicImpactPayload | null = null;
  reportsPayload: PublicReportsPayload | null = null;

  posts: PublicPostItem[] = [];
  postsLoading = true;
  postsErrorMessage = '';
  isConfirmingDonation = false;
  donationFeedbackMessage = '';
  donationFeedbackTone: 'success' | 'info' | 'error' = 'info';

  loading = false;
  errorMessage = '';

  aidDistributionChart: DonutChartOptions = this.createEmptyDonutChart();
  familiesByAreaChart: BarChartOptions = this.createEmptyFamiliesByAreaChart();
  financialBreakdownChart: DonutChartOptions = this.createEmptyDonutChart();
  donationTimelineChart: BarChartOptions = this.createEmptyTimelineChart();

  readonly faqSearchControl = new FormControl<string>('', { nonNullable: true });
  private readonly faqItems: FaqSeedItem[] = [
    {
      id: 'mission',
      question: 'Quelle est la mission du projet ?',
      tags: ['mission', 'projet'],
    },
    {
      id: 'donate',
      question: 'Comment puis-je faire un don ?',
      tags: ['don', 'paiement', 'flouci', 'rib'],
    },
    {
      id: 'progress',
      question: "Comment suivre l'avancement d'une campagne ?",
      tags: ['campagnes', 'progression'],
    },
    {
      id: 'reports',
      question: 'Ou trouver les rapports publics ?',
      tags: ['rapports', 'pdf'],
    },
    {
      id: 'updates',
      question: 'Les donnees sont-elles mises a jour automatiquement ?',
      tags: ['mises a jour', 'donnees'],
    },
    {
      id: 'contact',
      question: "Comment contacter l'equipe ?",
      tags: ['aide', 'contact'],
    },
  ];

  @ViewChild('voiceOver') private voiceOver?: ElementRef<HTMLAudioElement>;
  @ViewChild('welcomeVideo') private welcomeVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild(PublicChatbotComponent) private assistantWidget?: PublicChatbotComponent;

  private readonly destroyRef = inject(DestroyRef);
  private welcomeMediaInteractionHandler: (() => void) | null = null;

  private welcomeVideoPlayCount = 0;
  private readonly welcomeVideoMaxPlays = 2;

  constructor(
    private readonly publicService: PublicService,
    private readonly snackBar: MatSnackBar,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.showWelcomeVideo =
      !PublicInfoComponent.hasSeenWelcomeVideoThisSession &&
      !this.hasSeenWelcomeVideoPersisted();
    this.loadPublicContent();
    this.handleDonationReturnFromProvider();
    this.startPostsRealtimeFeed();
  }

  ngAfterViewInit(): void {
    const audio = this.voiceOver?.nativeElement;

    if (audio) {
      this.destroyRef.onDestroy(() => {
        this.removeWelcomeMediaInteractionListeners();
        audio.pause();
        audio.currentTime = 0;
      });
    }

    this.tryPlayWelcomeVideo();
  }

  onWelcomeVideoEnded(): void {
    this.welcomeVideoPlayCount += 1;

    if (this.welcomeVideoPlayCount < this.welcomeVideoMaxPlays) {
      this.restartWelcomeVideo();
      return;
    }

    this.finishWelcomeVideo(true);
  }

  onWelcomeVideoError(): void {
    // If the media fails to load, don't block the user. We only persist the "seen" state
    // after completing the expected 2 plays.
    this.finishWelcomeVideo(false);
  }

  private tryPlayWelcomeVideo(): void {
    if (!this.showWelcomeVideo) {
      return;
    }

    const video = this.welcomeVideo?.nativeElement;
    const audio = this.voiceOver?.nativeElement;

    if (!video) {
      return;
    }

    // Ensure the video doesn't run ahead of audio; if audio autoplay is blocked we will pause and wait.
    this.welcomeVideoNeedsUserAction = false;
    video.controls = false;

    video.currentTime = 0;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    void video.play().catch(() => {
      // Autoplay may be blocked by the browser; let the user start playback manually.
      this.welcomeVideoNeedsUserAction = true;
      video.controls = true;

      if (audio) {
        this.blockWelcomeUntilInteraction(video, audio);
      }
    });

    if (audio) {
      void audio.play().catch(() => {
        this.blockWelcomeUntilInteraction(video, audio);
      });
    }
  }

  private restartWelcomeVideo(): void {
    const video = this.welcomeVideo?.nativeElement;

    if (!video) {
      this.finishWelcomeVideo(false);
      return;
    }

    this.welcomeVideoNeedsUserAction = false;
    video.controls = false;

    video.currentTime = 0;

    void video.play().catch(() => {
      this.welcomeVideoNeedsUserAction = true;
      video.controls = true;
    });
  }

  private finishWelcomeVideo(persistSeen: boolean): void {
    if (!this.showWelcomeVideo) {
      return;
    }

    const video = this.welcomeVideo?.nativeElement;

    if (video) {
      video.pause();
      video.currentTime = 0;
    }

    this.removeWelcomeMediaInteractionListeners();
    this.welcomeVideoPlayCount = 0;
    this.welcomeVideoNeedsUserAction = false;
    this.showWelcomeVideo = false;
    PublicInfoComponent.hasSeenWelcomeVideoThisSession = true;

    if (persistSeen) {
      this.persistWelcomeVideoSeen();
    }
  }

  private blockWelcomeUntilInteraction(video: HTMLVideoElement, audio: HTMLAudioElement): void {
    // Autoplay with sound is commonly blocked; pause the video so the intro stays synced.
    video.pause();
    video.currentTime = 0;
    audio.pause();
    audio.currentTime = 0;

    // Reset play-count so the user still gets the full "2 plays" once interaction happens.
    this.welcomeVideoPlayCount = 0;

    this.welcomeVideoNeedsUserAction = true;
    video.controls = true;
    this.installWelcomeMediaInteractionStart(video, audio);
  }

  get impactCards(): ImpactCard[] {
    if (!this.impact) {
      return [];
    }

    return [
      {
        label: 'Familles aidees',
        value: this.impact.summary.familiesHelped,
        icon: 'groups',
        accent: 'blue',
      },
      {
        label: "Unites d'aide distribuees",
        value: this.impact.summary.aidUnitsDistributed,
        icon: 'volunteer_activism',
        accent: 'teal',
      },
      {
        label: 'Visites effectuees',
        value: this.impact.summary.visitsCompleted,
        icon: 'event_available',
        accent: 'amber',
      },
      {
        label: 'Zones couvertes',
        value: this.impact.summary.areasServed,
        icon: 'public',
        accent: 'slate',
      },
    ];
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

  get latestReports(): PublicReportItem[] {
    if (!this.reportsPayload) {
      return [];
    }

    return [...this.reportsPayload.reports]
      .sort((first, second) => {
        return new Date(second.publishedAt).getTime() - new Date(first.publishedAt).getTime();
      })
      .slice(0, 3);
  }

  get financialSummary(): FinancialSummary | null {
    return this.reportsPayload?.financialSummary || null;
  }

  get filteredFaqItems(): FaqItemView[] {
    const query = this.faqSearchControl.value.trim().toLowerCase();
    const items = this.faqItems.map((item) => ({
      ...item,
      answer: this.buildFaqAnswer(item),
    }));

    if (!query) {
      return items;
    }

    return items.filter((item) => {
      const haystack = `${item.question} ${item.answer} ${item.tags.join(' ')}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  trackPostById(_index: number, post: PublicPostItem): string {
    return post._id;
  }

  trackFaqById(_index: number, item: FaqItemView): string {
    return item.id;
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('fr-FR').format(value);
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: this.financialSummary?.currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatPostCurrency(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatProgress(value: number): string {
    const normalized = Math.max(0, Math.min(value, 100));
    return Number.isInteger(normalized) ? `${normalized}%` : `${normalized.toFixed(1)}%`;
  }

  get donationPopupPost(): PublicPostItem | null {
    const postId = this.donationPopupPostId;

    if (!postId) {
      return null;
    }

    return this.posts.find((post) => post._id === postId) || null;
  }

  postProgressTone(post: PublicPostItem): ProgressTone {
    if (post.progressPercent >= 80) {
      return 'orange';
    }

    if (post.progressPercent >= 50) {
      return 'blue';
    }

    return 'green';
  }

  progressBarStyle(post: PublicPostItem): Record<string, string> {
    const normalized = Math.max(0, Math.min(post.progressPercent, 100));
    return {
      width: `${normalized}%`,
    };
  }

  openDonationPopup(post: PublicPostItem): void {
    this.donationPopupPostId = post._id;
    this.donationPopupOpen = true;
    this.donationCheckoutErrorMessage = '';
    this.donationAmountControl.setValue(null);
    this.donationAmountControl.markAsPristine();
    this.donationAmountControl.markAsUntouched();
  }

  closeDonationPopup(): void {
    if (this.donationCheckoutLoading) {
      return;
    }

    this.donationPopupOpen = false;
    this.donationPopupPostId = null;
    this.donationCheckoutErrorMessage = '';
  }

  @HostListener('document:keydown.escape')
  onDonationPopupEscape(): void {
    if (!this.donationPopupOpen) {
      return;
    }

    this.closeDonationPopup();
  }

  submitDonation(): void {
    const post = this.donationPopupPost;

    this.donationCheckoutErrorMessage = '';
    this.donationAmountControl.markAsTouched();

    if (!post) {
      this.donationCheckoutErrorMessage = "Impossible de trouver la campagne selectionnee. Veuillez reessayer.";
      return;
    }

    if (this.donationAmountControl.invalid) {
      return;
    }

    const amount = Number(this.donationAmountControl.value);

    if (!Number.isFinite(amount) || amount <= 0) {
      this.donationCheckoutErrorMessage = 'Veuillez saisir un montant valide.';
      return;
    }

    this.donationCheckoutLoading = true;

    const currency = String(this.financialSummary?.currency || 'USD')
      .trim()
      .slice(0, 3)
      .toLowerCase();

    this.publicService
      .createDonationCheckout(post._id, {
        amount,
        currency,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (checkout) => {
          // In dev/test, the backend can run with PAYMENT_PROVIDER=mock and returns a paid session immediately.
          if (String(checkout.provider).toLowerCase() === 'mock') {
            this.publicService
              .confirmDonation(post._id, checkout.sessionId)
              .pipe(
                takeUntilDestroyed(this.destroyRef),
                finalize(() => {
                  this.donationCheckoutLoading = false;
                })
              )
              .subscribe({
                next: (confirmation) => {
                  this.upsertPost(confirmation.post);
                  this.setDonationFeedback(confirmation.message, 'success');
                  this.snackBar.open(confirmation.message, 'Fermer', {
                    duration: 4200,
                  });
                  this.donationAmountControl.setValue(null);
                  this.donationAmountControl.markAsPristine();
                  this.donationAmountControl.markAsUntouched();
                },
                error: (error: unknown) => {
                  const message = extractApiErrorMessage(error, 'Impossible de confirmer le don.');
                  this.donationCheckoutErrorMessage = message;
                  this.setDonationFeedback(message, 'error');
                },
              });
            return;
          }

          // For Stripe (or other providers), redirect to checkout; the provider returns to /public/info which
          // triggers handleDonationReturnFromProvider() to confirm and update the progress.
          this.donationCheckoutLoading = false;
          this.closeDonationPopup();

          if (typeof window !== 'undefined') {
            window.location.assign(checkout.checkoutUrl);
          }
        },
        error: (error: unknown) => {
          this.donationCheckoutLoading = false;
          const message = extractApiErrorMessage(
            error,
            'Impossible de demarrer le paiement. Verifiez la configuration du prestataire.'
          );
          this.donationCheckoutErrorMessage = message;
          this.setDonationFeedback(message, 'error');
        },
      });
  }

  async sharePost(post: PublicPostItem): Promise<void> {
    const shareUrl = `${window.location.origin}/public/info#post-${post._id}`;
    const shareData = {
      title: post.title,
      text: post.content,
      url: shareUrl,
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData);
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${post.title}\n${shareUrl}`);
        this.snackBar.open('Lien de partage copie dans le presse-papiers.', 'Fermer', {
          duration: 2800,
        });
        return;
      }

      this.snackBar.open("Le partage n'est pas pris en charge sur ce navigateur.", 'Fermer', {
        duration: 3000,
      });
    } catch {
      this.snackBar.open('Impossible de partager ce post pour le moment.', 'Fermer', {
        duration: 3000,
      });
    }
  }

  openAssistant(): void {
    const widget = this.assistantWidget;

    if (!widget) {
      return;
    }

    if (!widget.isOpen) {
      widget.toggleWidget();
    }
  }

  progressAriaValueText(post: PublicPostItem): string {
    const percent = this.formatProgress(post.progressPercent);
    const raised = this.formatPostCurrency(post.amountRaised);
    const goal = this.formatPostCurrency(post.donationGoal);
    const remaining = this.formatPostCurrency(post.remainingAmount);

    return `${percent}. ${raised} collectes sur ${goal}. ${remaining} restants.`;
  }

  private loadPublicContent(): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      info: this.publicService.getInfo(),
      impact: this.publicService.getImpact(),
      reports: this.publicService.getReports(),
    })
      .pipe(
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, 'Impossible de charger les informations publiques.');
          return EMPTY;
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe(({ info, impact, reports }) => {
        this.info = info;
        this.impact = impact;
        this.reportsPayload = reports;

        this.aidDistributionChart = this.buildAidDistributionChart(impact);
        this.familiesByAreaChart = this.buildFamiliesByAreaChart(impact);
        this.financialBreakdownChart = this.buildFinancialBreakdownChart(reports.financialSummary);
        this.donationTimelineChart = this.buildDonationTimelineChart(reports);
      });
  }

  private startPostsRealtimeFeed(): void {
    this.postsLoading = true;
    this.postsErrorMessage = '';

    this.publicService
      .watchPosts(7000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (posts) => {
          this.posts = posts;
          this.postsLoading = false;
          this.postsErrorMessage = '';
        },
        error: (error: unknown) => {
          this.postsLoading = false;
          this.postsErrorMessage = extractApiErrorMessage(error, 'Impossible de charger les campagnes de dons.');
        },
      });
  }

  private handleDonationReturnFromProvider(): void {
    const status = String(this.route.snapshot.queryParamMap.get('donationStatus') || '').toLowerCase();
    const postId = this.route.snapshot.queryParamMap.get('postId');
    const sessionId = this.route.snapshot.queryParamMap.get('session_id');

    if (!status && !postId && !sessionId) {
      return;
    }

    if (status === 'cancel') {
      this.setDonationFeedback('Le don a ete annule. Vous pouvez reessayer a tout moment.', 'info');
      this.snackBar.open('Don annule.', 'Fermer', {
        duration: 3200,
      });
      this.clearDonationQueryParams();
      return;
    }

    if (status !== 'success' || !postId || !sessionId) {
      this.setDonationFeedback('Donnees de retour du don invalides. Veuillez reessayer.', 'error');
      this.clearDonationQueryParams();
      return;
    }

    this.isConfirmingDonation = true;
    this.setDonationFeedback('Confirmation de votre don...', 'info');

    this.publicService
      .confirmDonation(postId, sessionId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isConfirmingDonation = false;
          this.clearDonationQueryParams();
        })
      )
      .subscribe({
        next: (confirmation) => {
          this.upsertPost(confirmation.post);

          this.setDonationFeedback(confirmation.message, 'success');
          this.snackBar.open(confirmation.message, 'Fermer', {
            duration: 4200,
          });
        },
        error: (error: unknown) => {
          const message = extractApiErrorMessage(error, 'Impossible de confirmer le don.');
          this.setDonationFeedback(message, 'error');
          this.snackBar.open(message, 'Fermer', {
            duration: 4200,
          });
        },
      });
  }

  private clearDonationQueryParams(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
      fragment: this.route.snapshot.fragment || undefined,
    });
  }

  private setDonationFeedback(
    message: string,
    tone: 'success' | 'info' | 'error'
  ): void {
    this.donationFeedbackMessage = message;
    this.donationFeedbackTone = tone;
  }

  private upsertPost(updatedPost: PublicPostItem): void {
    const index = this.posts.findIndex((post) => post._id === updatedPost._id);

    if (index === -1) {
      this.posts = [updatedPost, ...this.posts];
      return;
    }

    const nextPosts = [...this.posts];
    nextPosts[index] = updatedPost;
    this.posts = nextPosts;
  }

  private buildAidDistributionChart(impact: PublicImpactPayload): DonutChartOptions {
    if (!impact.aidDistribution.length) {
      return this.createEmptyDonutChart();
    }

    return {
      series: impact.aidDistribution.map((item) => item.totalQuantity),
      labels: impact.aidDistribution.map((item) => item.label),
      chart: {
        type: 'donut',
        height: 340,
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
      colors: ['#0c4a6e', '#0f766e', '#b45309', '#475569', '#1d4ed8'],
    };
  }

  private buildFamiliesByAreaChart(impact: PublicImpactPayload): BarChartOptions {
    const byArea = [...impact.areas]
      .sort((first, second) => second.totalFamilies - first.totalFamilies)
      .slice(0, 6);

    if (!byArea.length) {
      return this.createEmptyFamiliesByAreaChart();
    }

    return {
      series: [
        {
          name: 'Familles',
          data: byArea.map((item) => item.totalFamilies),
        },
      ],
      chart: {
        type: 'bar',
        height: 340,
        toolbar: {
          show: false,
        },
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
      plotOptions: {
        bar: {
          borderRadius: 7,
          horizontal: true,
          barHeight: '52%',
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
        categories: byArea.map((item) => item.zone),
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

  private buildFinancialBreakdownChart(summary: FinancialSummary): DonutChartOptions {
    if (!summary.breakdown.length) {
      return this.createEmptyDonutChart();
    }

    return {
      series: summary.breakdown.map((item) => item.percentage),
      labels: summary.breakdown.map((item) => item.label),
      chart: {
        type: 'donut',
        height: 340,
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

  private buildDonationTimelineChart(payload: PublicReportsPayload): BarChartOptions {
    if (!payload.financialTimeline.length) {
      return this.createEmptyTimelineChart();
    }

    const timeline = [...payload.financialTimeline].sort((first, second) => first.year - second.year);

    return {
      series: [
        {
          name: 'Dons estimes',
          data: timeline.map((item) => item.donationEstimate),
        },
        {
          name: 'Depenses estimees',
          data: timeline.map((item) => item.spentEstimate),
        },
      ],
      chart: {
        type: 'bar',
        height: 340,
        toolbar: {
          show: false,
        },
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
      plotOptions: {
        bar: {
          borderRadius: 6,
          columnWidth: '45%',
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
        categories: timeline.map((item) => String(item.year)),
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

  private createEmptyDonutChart(): DonutChartOptions {
    return {
      series: [1],
      labels: ['Aucune donnee pour le moment'],
      chart: {
        type: 'donut',
        height: 340,
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

  private createEmptyFamiliesByAreaChart(): BarChartOptions {
    return {
      series: [
        {
          name: 'Familles',
          data: [0],
        },
      ],
      chart: {
        type: 'bar',
        height: 340,
        toolbar: {
          show: false,
        },
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
      plotOptions: {
        bar: {
          borderRadius: 7,
          horizontal: true,
          barHeight: '52%',
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

  private createEmptyTimelineChart(): BarChartOptions {
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
        height: 340,
        toolbar: {
          show: false,
        },
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
      plotOptions: {
        bar: {
          borderRadius: 6,
          columnWidth: '45%',
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

  private buildFaqAnswer(item: FaqSeedItem): string {
    if (item.id === 'mission') {
      return (
        this.info?.organization?.mission ||
        "Notre mission est d'aider les familles dans le besoin avec une aide organisee, des visites, et un suivi transparent."
      );
    }

    if (item.id === 'donate') {
      const campaignsCount = this.posts.length;
      const campaignsLabel =
        campaignsCount === 0
          ? "Il n'y a aucune campagne active pour le moment."
          : campaignsCount === 1
            ? 'Il y a actuellement 1 campagne active.'
            : `Il y a actuellement ${campaignsCount} campagnes actives.`;

      return `Rendez-vous dans la section \"Campagnes de dons\" sur cette page, choisissez une campagne, puis cliquez sur \"Make Donation\". Un formulaire (popup) vous permet de saisir un montant et de lancer le paiement. RIB: ${this.donationRib}. ${campaignsLabel}`;
    }

    if (item.id === 'progress') {
      const campaign = this.primaryCampaignForFaq();

      if (!campaign) {
        return "Chaque campagne affiche son pourcentage d'avancement, le montant collecte et le montant restant. Aucune campagne active n'est disponible pour le moment.";
      }

      return `Dans la section \"Campagnes de dons\", chaque carte affiche la progression (pourcentage, montant collecte et montant restant). Exemple: \"${campaign.title}\" est a ${campaign.progressPercent}% (${this.formatPostCurrency(
        campaign.amountRaised
      )} collectes sur ${this.formatPostCurrency(campaign.donationGoal)}).`;
    }

    if (item.id === 'reports') {
      const latest = this.latestReports?.[0];

      if (!latest) {
        return 'Les rapports publics sont disponibles sur la page Rapports.';
      }

      return `Le dernier rapport publie est \"${latest.title}\" (${latest.year}). Consultez tous les rapports sur la page Rapports.`;
    }

    if (item.id === 'updates') {
      return "Les campagnes de dons sont mises a jour automatiquement (flux en temps reel). Les rapports et indicateurs d'impact sont generes a partir des donnees disponibles dans le systeme.";
    }

    return "Cliquez sur \"Ouvrir l'assistant\" (en bas a droite) pour poser votre question, ou consultez la page Rapports pour plus de details.";
  }

  private primaryCampaignForFaq(): PublicPostItem | null {
    if (!this.posts.length) {
      return null;
    }

    return [...this.posts].sort((left, right) => {
      const leftRemaining = Math.max(left.donationGoal - left.amountRaised, 0);
      const rightRemaining = Math.max(right.donationGoal - right.amountRaised, 0);
      return rightRemaining - leftRemaining;
    })[0];
  }

  private installWelcomeMediaInteractionStart(video: HTMLVideoElement, audio: HTMLAudioElement): void {
    if (typeof document === 'undefined') {
      return;
    }

    if (this.welcomeMediaInteractionHandler) {
      return;
    }

    this.welcomeMediaInteractionHandler = () => {
      this.removeWelcomeMediaInteractionListeners();

      this.welcomeVideoPlayCount = 0;
      this.welcomeVideoNeedsUserAction = false;
      video.controls = false;

      video.currentTime = 0;
      audio.pause();
      audio.currentTime = 0;

      void video.play().catch(() => {
        this.welcomeVideoNeedsUserAction = true;
        video.controls = true;
      });

      void audio.play().catch(() => {
        this.blockWelcomeUntilInteraction(video, audio);
      });
    };

    document.addEventListener('pointerdown', this.welcomeMediaInteractionHandler);
    document.addEventListener('keydown', this.welcomeMediaInteractionHandler);
    document.addEventListener('touchstart', this.welcomeMediaInteractionHandler);
  }

  private removeWelcomeMediaInteractionListeners(): void {
    const handler = this.welcomeMediaInteractionHandler;

    if (!handler) {
      return;
    }

    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerdown', handler);
      document.removeEventListener('keydown', handler);
      document.removeEventListener('touchstart', handler);
    }

    this.welcomeMediaInteractionHandler = null;
  }

  private hasSeenWelcomeVideoPersisted(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      return localStorage.getItem(PublicInfoComponent.welcomeVideoStorageKey) === 'true';
    } catch {
      return false;
    }
  }

  private persistWelcomeVideoSeen(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(PublicInfoComponent.welcomeVideoStorageKey, 'true');
    } catch {
      // Ignore storage failures (e.g. privacy mode / storage disabled).
    }
  }

}
