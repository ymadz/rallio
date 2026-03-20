'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { formatTo12Hour } from '@/lib/utils';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import logo from '@/assets/logo.png';
import {
  getSameTimeBookingEligibleDatesAction,
  getVenueDailyAvailabilitySummaryAction,
  getAvailableTimeSlotsAction,
  checkCartAvailabilityAction,
} from '@/app/actions/reservations';
import { calculateApplicableDiscounts } from '@/app/actions/discount-actions';
import { useCheckoutStore } from '@/stores/checkout-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';

interface Court {
  id: string;
  name: string;
  description: string | null;
  surface_type: string;
  court_type: string;
  capacity: number;
  hourly_rate: number;
  is_active: boolean;
}

interface TimeSlot {
  time: string;
  available: boolean;
  price?: number;
}

interface SelectedCell {
  courtId: string;
  time: string;
}

type RepeatMode = 'none' | 'weekly' | 'custom';

interface VenueScheduleGridProps {
  courts: Court[];
  venueId: string;
  venueName: string;
}

interface DailyAvailabilitySummary {
  totalSlots: number;
  availableSlots: number;
}

const LOW_AVAILABILITY_THRESHOLD = 10;

function to12Hour(time: string) {
  return formatTo12Hour(time);
}

function nextHour(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const next = hours + 1;
  return `${next.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return format(d, 'yyyy-MM-dd');
}

function shortDate(dateStr: string): string {
  return format(new Date(dateStr + 'T00:00:00'), 'MMM d');
}

function getTimeSectionLabel(time: string): string {
  const hour = Number(time.split(':')[0]);
  if (hour < 12) return 'Morning Block';
  if (hour < 18) return 'Afternoon Block';
  return 'Evening Block';
}

export function VenueScheduleGrid({ courts, venueId, venueName }: VenueScheduleGridProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [slotsByCourt, setSlotsByCourt] = useState<Record<string, TimeSlot[]>>({});
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [additionalDates, setAdditionalDates] = useState<string[]>([]);
  const [isBooking, setIsBooking] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [validatingConflicts, setValidatingConflicts] = useState(false);
  const [activeConflicts, setActiveConflicts] = useState<any[]>([]);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [pendingCartItems, setPendingCartItems] = useState<any[]>([]);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [calendarSummary, setCalendarSummary] = useState<Record<string, DailyAvailabilitySummary>>({});
  const [loadingCalendarSummary, setLoadingCalendarSummary] = useState(false);
  const [isAddDatePickerOpen, setIsAddDatePickerOpen] = useState(false);
  const [sameTimeEligibilityByDate, setSameTimeEligibilityByDate] = useState<Record<string, boolean>>({});
  const [loadingSameTimeEligibility, setLoadingSameTimeEligibility] = useState(false);

  const { bookingCart, setBookingCart, setDiscountDetails, setConflictingSlots } =
    useCheckoutStore();

  useEffect(() => {
    async function load() {
      if (!selectedDate || courts.length === 0) return;
      setLoading(true);
      setSelectedCells([]);

      try {
        const results = await Promise.all(
          courts.map(async (court) => {
            const slots = await getAvailableTimeSlotsAction(court.id, selectedDate);
            return { courtId: court.id, slots };
          })
        );

        const map: Record<string, TimeSlot[]> = {};
        for (const result of results) {
          map[result.courtId] = result.slots;
        }

        setSlotsByCourt(map);
      } catch (error) {
        setSlotsByCourt({});
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [selectedDate, courts]);

  const allDatesToBook = useMemo(() => {
    if (repeatMode === 'none') return [selectedDate];
    if (repeatMode === 'weekly') {
      const dates: string[] = [];
      for (let i = 0; i < repeatWeeks; i++) {
        dates.push(addDays(selectedDate, i * 7));
      }
      return dates;
    }
    return Array.from(new Set([selectedDate, ...additionalDates])).sort();
  }, [selectedDate, repeatMode, repeatWeeks, additionalDates]);

  // Reactive Conflict Detection
  useEffect(() => {
    const checkConflicts = async () => {
      if (selectedCells.length === 0) {
        setActiveConflicts([]);
        return;
      }

      setValidatingConflicts(true);
      try {
        const cartItemsForCheck: any[] = [];
        for (const date of allDatesToBook) {
          for (const cell of selectedCells) {
            cartItemsForCheck.push({
              courtId: cell.courtId,
              date: new Date(`${date}T${cell.time}:00`),
              startTime: cell.time,
              endTime: nextHour(cell.time),
              recurrenceWeeks: 1,
            });
          }
        }

        const result = await checkCartAvailabilityAction(cartItemsForCheck);
        setActiveConflicts(result.conflicts || []);
      } catch (error) {
        console.error('Reactive validation failed:', error);
      } finally {
        setValidatingConflicts(false);
      }
    };

    const timer = setTimeout(checkConflicts, 400);
    return () => clearTimeout(timer);
  }, [selectedCells, allDatesToBook]);

  const allTimes = useMemo(() => {
    const times = new Set<string>();
    Object.values(slotsByCourt).forEach((slots) => {
      slots.forEach((slot) => times.add(slot.time));
    });
    return Array.from(times).sort((a, b) => a.localeCompare(b));
  }, [slotsByCourt]);

  const availableSlotCount = useMemo(
    () => Object.values(slotsByCourt).flat().filter((slot) => slot.available).length,
    [slotsByCourt]
  );

  const groupedTimes = useMemo(() => {
    const groups: Array<{ label: string; times: string[] }> = [];

    allTimes.forEach((time) => {
      const label = getTimeSectionLabel(time);
      const lastGroup = groups[groups.length - 1];

      if (!lastGroup || lastGroup.label !== label) {
        groups.push({ label, times: [time] });
        return;
      }

      lastGroup.times.push(time);
    });

    return groups;
  }, [allTimes]);

  const selectedTotal = useMemo(() => {
    return selectedCells.reduce((sum, cell) => {
      const court = courts.find((c) => c.id === cell.courtId);
      const slot = slotsByCourt[cell.courtId]?.find((s) => s.time === cell.time);
      return sum + Number(slot?.price || court?.hourly_rate || 0);
    }, 0);
  }, [selectedCells, courts, slotsByCourt]);

  const validSlotCount = Math.max(
    0,
    selectedCells.length * allDatesToBook.length - activeConflicts.length
  );
  const accurateTotalEstimate = selectedCells.reduce((sum, cell) => {
    const court = courts.find((c) => c.id === cell.courtId);
    const slot = slotsByCourt[cell.courtId]?.find((s) => s.time === cell.time);
    const rate = Number(slot?.price || court?.hourly_rate || 0);

    const cellConflicts = activeConflicts.filter(
      (c) => c.courtId === cell.courtId && c.startTime === cell.time
    );
    const validDatesForCell = Math.max(0, allDatesToBook.length - cellConflicts.length);

    return sum + rate * validDatesForCell;
  }, 0);

  const isSelected = (courtId: string, time: string) =>
    selectedCells.some((cell) => cell.courtId === courtId && cell.time === time);

  const isCellConflicted = (courtId: string, time: string) =>
    activeConflicts.some((c) => c.courtId === courtId && c.startTime === time);

  const toggleCell = (courtId: string, time: string) => {
    const slot = slotsByCourt[courtId]?.find((s) => s.time === time);
    if (!slot?.available) return;

    setSelectedCells((prev) => {
      const exists = prev.some((cell) => cell.courtId === courtId && cell.time === time);
      if (exists) {
        return prev.filter((cell) => !(cell.courtId === courtId && cell.time === time));
      }
      return [...prev, { courtId, time }];
    });
  };

  const handleBookNow = async () => {
    if (selectedCells.length === 0 || isBooking || isChecking) {
      setNotice('Select at least one available slot first.');
      return;
    }

    setIsBooking(true);
    const cartItems: any[] = [];

    for (const date of allDatesToBook) {
      const dateCellsByCourt: Record<string, string[]> = {};
      for (const cell of selectedCells) {
        if (!dateCellsByCourt[cell.courtId]) dateCellsByCourt[cell.courtId] = [];
        dateCellsByCourt[cell.courtId].push(cell.time);
      }

      for (const courtId in dateCellsByCourt) {
        const court = courts.find((c) => c.id === courtId);
        if (!court) continue;

        const times = dateCellsByCourt[courtId].sort();
        const blocks: Array<{ start: string; end: string }> = [];
        let currentBlock = { start: times[0], end: nextHour(times[0]) };

        for (let i = 1; i < times.length; i++) {
          const time = times[i];
          if (time === currentBlock.end) {
            currentBlock.end = nextHour(time);
          } else {
            blocks.push(currentBlock);
            currentBlock = { start: time, end: nextHour(time) };
          }
        }
        blocks.push(currentBlock);

        for (const block of blocks) {
          cartItems.push({
            courtId: court.id,
            courtName: court.name,
            venueId,
            venueName,
            date: new Date(`${date}T${block.start}:00`),
            startTime: block.start,
            endTime: block.end,
            hourlyRate: court.hourly_rate,
            capacity: court.capacity,
            recurrenceWeeks: 1,
          });
        }
      }
    }

    if (cartItems.length === 0) {
      setNotice('No valid slots to book.');
      setIsBooking(false);
      return;
    }

    setIsChecking(true);
    try {
      const result = await checkCartAvailabilityAction(
        cartItems.map((item) => ({
          courtId: item.courtId,
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
          recurrenceWeeks: 1,
        }))
      );

      if (!result.available && result.conflicts.length > 0) {
        setConflicts(result.conflicts);
        setPendingCartItems(cartItems);
        setConflictModalOpen(true);
        setIsChecking(false);
        setIsBooking(false);
        return;
      }
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setIsChecking(false);
    }

    confirmBooking(cartItems, []);
  };

  const toDateTimeWithOffset = (date: Date, time: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return `${dateStr}T${time}:00+08:00`;
  };

  const getDurationHours = (startTime: string, endTime: string) => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    let duration = (endH + (endM || 0) / 60) - (startH + (startM || 0) / 60);
    if (duration <= 0) duration += 24;
    return duration;
  };

  const confirmBooking = async (items: any[], conflictList: any[]) => {
    setIsBooking(true);

    // Filter out items that match a conflict in the conflictList
    const validItems = items.filter((item) => {
      const itemDateStr = format(item.date, 'yyyy-MM-dd');
      const hasConflict = conflictList.some(
        (c) =>
          c.courtId === item.courtId &&
          c.startTime === item.startTime &&
          (c.dateISO === itemDateStr || c.date === format(item.date, 'MMM d, yyyy'))
      );
      return !hasConflict;
    });

    if (validItems.length === 0) {
      setNotice('No valid slots available after conflict checks.');
      setIsBooking(false);
      return;
    }

    setBookingCart(validItems);
    setConflictingSlots(conflictList);

    try {
      const sortedItems = [...validItems].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const totalBasePrice = validItems.reduce((sum, item) => {
        const duration = getDurationHours(item.startTime, item.endTime);
        return sum + item.hourlyRate * duration;
      }, 0);

      const uniqueDateCount = new Set(
        validItems.map((item) => format(new Date(item.date), 'yyyy-MM-dd'))
      ).size;

      const earliest = sortedItems[0];
      const latest = sortedItems[sortedItems.length - 1];

      const discountResult = await calculateApplicableDiscounts({
        venueId,
        courtId: earliest.courtId,
        startDate: toDateTimeWithOffset(new Date(earliest.date), earliest.startTime),
        endDate: toDateTimeWithOffset(new Date(latest.date), latest.endTime),
        recurrenceWeeks: 1,
        targetDateCount: uniqueDateCount,
        basePrice: totalBasePrice,
      });

      if (discountResult.success) {
        setDiscountDetails({
          amount: discountResult.totalDiscount,
          type: discountResult.discounts.map((d) => d.type).join(', ') || undefined,
          reason: discountResult.discounts.map((d) => d.name).join(', ') || undefined,
          discounts: discountResult.discounts,
        });
      } else {
        setDiscountDetails({ amount: 0, type: undefined, reason: undefined, discounts: [] });
      }
    } catch (error) {
      console.error('Failed to calculate discounts before checkout:', error);
      setDiscountDetails({ amount: 0, type: undefined, reason: undefined, discounts: [] });
    }

    router.push('/checkout');
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const selectedDateLabel = format(new Date(selectedDate + 'T00:00:00'), 'EEE, MMM d');

  useEffect(() => {
    setCalendarMonth(new Date(selectedDate + 'T00:00:00'));
  }, [selectedDate]);

  useEffect(() => {
    async function loadCalendarSummary() {
      if (!isDatePickerOpen || courts.length === 0) return;

      setLoadingCalendarSummary(true);
      try {
        const monthStart = format(startOfMonth(calendarMonth), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(calendarMonth), 'yyyy-MM-dd');
        const summary = await getVenueDailyAvailabilitySummaryAction({
          venueId,
          startDate: monthStart,
          endDate: monthEnd,
        });
        setCalendarSummary(summary || {});
      } catch (error) {
        console.error('Failed to load calendar summary:', error);
        setCalendarSummary({});
      } finally {
        setLoadingCalendarSummary(false);
      }
    }

    loadCalendarSummary();
  }, [isDatePickerOpen, calendarMonth, venueId, courts.length]);

  useEffect(() => {
    async function loadSameTimeEligibility() {
      if (!isAddDatePickerOpen || repeatMode !== 'custom') return;

      if (selectedCells.length === 0) {
        setSameTimeEligibilityByDate({});
        return;
      }

      setLoadingSameTimeEligibility(true);
      try {
        const monthStart = format(startOfMonth(calendarMonth), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(calendarMonth), 'yyyy-MM-dd');

        const selections = selectedCells.map((cell) => ({
          courtId: cell.courtId,
          startTime: cell.time,
          endTime: nextHour(cell.time),
        }));

        const result = await getSameTimeBookingEligibleDatesAction({
          startDate: monthStart,
          endDate: monthEnd,
          selections,
        });

        setSameTimeEligibilityByDate(result || {});
      } catch (error) {
        console.error('Failed to load same-time booking eligibility:', error);
        setSameTimeEligibilityByDate({});
      } finally {
        setLoadingSameTimeEligibility(false);
      }
    }

    loadSameTimeEligibility();
  }, [isAddDatePickerOpen, repeatMode, selectedCells, calendarMonth]);

  const isDateFullyBooked = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const day = calendarSummary[dateKey];
    return !!day && day.totalSlots > 0 && day.availableSlots === 0;
  };

  const getLowAvailabilityCount = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const day = calendarSummary[dateKey];
    if (!day || day.availableSlots <= 0) return null;
    if (day.availableSlots > LOW_AVAILABILITY_THRESHOLD) return null;
    return day.availableSlots;
  };

  const isCalendarDateDisabled = (date: Date) => {
    const start = new Date(today + 'T00:00:00');
    if (date < start) return true;
    return isDateFullyBooked(date);
  };

  const isSameTimeEligible = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    if (selectedCells.length === 0) return true;
    return sameTimeEligibilityByDate[dateKey] === true;
  };

  const isCustomAddDateDisabled = (date: Date) => {
    if (isCalendarDateDisabled(date)) return true;
    if (selectedCells.length === 0) return false;
    if (loadingSameTimeEligibility) return true;
    return !isSameTimeEligible(date);
  };

  const shiftSelectedDate = (days: number) => {
    const nextDate = addDays(selectedDate, days);
    if (nextDate < today) return;
    setSelectedDate(nextDate);
    setAdditionalDates((prev) => prev.filter((d) => d !== nextDate));
  };

  return (
    <div className="mb-6 rounded-2xl border border-gray-200/90 bg-white p-4 md:p-6">
      {/* 1) Top Control Header */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Image src={logo} alt="Rallio" width={40} height={40} className="h-10 w-10 flex-shrink-0" />
          <h3 className="text-2xl font-bold text-gray-900">Book a Court</h3>
        </div>
      </div>

      <div className="mb-4 flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-black" />
          <span className="text-lg font-bold text-black md:text-xl">{selectedDateLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftSelectedDate(-1)}
            disabled={selectedDate <= today}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-black hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <DropdownMenu open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-black hover:bg-gray-50"
                aria-label="Open date picker"
              >
                <CalendarIcon className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="bottom"
              sideOffset={8}
              className="w-auto rounded-xl border border-gray-200 bg-white p-4 shadow-lg !max-h-none !overflow-visible"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <DayPicker
                mode="single"
                selected={new Date(selectedDate + 'T00:00:00')}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                onSelect={(date) => {
                  if (!date) return;
                  if (isCalendarDateDisabled(date)) return;
                  const newDate = format(date, 'yyyy-MM-dd');
                  setSelectedDate(newDate);
                  setAdditionalDates((prev) => prev.filter((d) => d !== newDate));
                  setIsDatePickerOpen(false);
                }}
                disabled={isCalendarDateDisabled}
                className="mx-auto"
                modifiers={{
                  fullyBooked: (date) => isDateFullyBooked(date),
                }}
                modifiersClassNames={{
                  selected: 'bg-primary text-white hover:bg-primary',
                  today: 'font-bold text-primary',
                  fullyBooked: 'bg-gray-200 text-gray-500 opacity-90 cursor-not-allowed',
                }}
                components={{
                  DayButton: ({ day, className, children, ...props }: any) => {
                    const date = day.date as Date;
                    const lowAvailabilityCount = getLowAvailabilityCount(date);
                    const fullyBooked = isDateFullyBooked(date);

                    return (
                      <button {...props} className={`${className ?? ''} relative`}>
                        <span>{children}</span>
                        {fullyBooked && (
                          <span className="pointer-events-none absolute left-1/2 top-1/2 h-[2px] w-[72%] -translate-x-1/2 -translate-y-1/2 rotate-[-35deg] bg-gray-600" />
                        )}
                        {lowAvailabilityCount !== null && (
                          <span className="pointer-events-none absolute right-0 top-0 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-4 text-white">
                            {lowAvailabilityCount}
                          </span>
                        )}
                      </button>
                    );
                  },
                }}
              />
              {loadingCalendarSummary && (
                <p className="mt-2 text-center text-[11px] text-gray-500">Loading date availability...</p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => shiftSelectedDate(1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-black hover:bg-gray-50"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2) Information / Legend Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2.5">
        <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Info className="h-3.5 w-3.5 text-gray-500" />
          Guide
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          Selected
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
          Booked
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
          <span className="h-2.5 w-2.5 rounded-full border border-gray-300 bg-gray-100" />
          Available
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
          <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center rounded bg-gray-200">
            <span className="absolute h-[1.5px] w-4 rotate-[-35deg] bg-gray-600" />
          </span>
          Fully Booked Day
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
            ≤10
          </span>
          Low Slots Left
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs">
          <span className="font-semibold text-gray-900">Open</span>
          <span className="text-gray-500">{availableSlotCount}</span>
        </span>
      </div>

      {/* Recurrence options */}
      <div className="mb-4 flex flex-wrap items-start gap-x-3 gap-y-3 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600 font-medium">Repeat:</span>
          {(['none', 'weekly', 'custom'] as RepeatMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setRepeatMode(mode);
                if (mode === 'none') setAdditionalDates([]);
              }}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                repeatMode === mode
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-primary hover:bg-primary/5',
              ].join(' ')}
            >
              {mode === 'none' ? 'No Repeat' : mode === 'weekly' ? 'Repeat Weekly' : 'Custom Dates'}
            </button>
          ))}
        </div>

        {repeatMode === 'weekly' && (
          <div className="flex items-center gap-2 w-full flex-wrap">
            <span className="text-sm text-gray-600">for</span>
            <select
              value={repeatWeeks}
              onChange={(e) => setRepeatWeeks(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} weeks
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">
              ({allDatesToBook.length} dates: {allDatesToBook.slice(0, 4).map(shortDate).join(', ')}
              {allDatesToBook.length > 4 ? ` +${allDatesToBook.length - 4} more` : ''})
            </span>
          </div>
        )}

        {repeatMode === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 w-full">
            <span className="text-xs text-gray-500 font-medium">Dates:</span>
            <span className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-medium">
              {shortDate(selectedDate)} (base)
            </span>
            {additionalDates.map((d) => (
              <span
                key={d}
                className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full"
              >
                {shortDate(d)}
                <button
                  onClick={() => setAdditionalDates((prev) => prev.filter((x) => x !== d))}
                  className="ml-0.5 font-bold leading-none hover:text-red-500"
                  aria-label={`Remove ${d}`}
                >
                  ×
                </button>
              </span>
            ))}
            <DropdownMenu open={isAddDatePickerOpen} onOpenChange={setIsAddDatePickerOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full border border-primary px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
                >
                  + Add date
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="bottom"
                sideOffset={8}
                className="w-auto rounded-xl border border-gray-200 bg-white p-4 shadow-lg !max-h-none !overflow-visible"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <DayPicker
                  mode="single"
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  disabled={isCustomAddDateDisabled}
                  modifiers={{
                    fullyBooked: (date) => isDateFullyBooked(date),
                    sameTimeIneligible: (date) => !isCalendarDateDisabled(date) && selectedCells.length > 0 && !isSameTimeEligible(date),
                  }}
                  modifiersClassNames={{
                    selected: 'bg-primary text-white hover:bg-primary',
                    today: 'font-bold text-primary',
                    fullyBooked: 'bg-gray-200 text-gray-500 opacity-90 cursor-not-allowed',
                    sameTimeIneligible: 'bg-gray-100 text-gray-400 opacity-80 cursor-not-allowed',
                  }}
                  onSelect={(date) => {
                    if (!date || isCustomAddDateDisabled(date)) return;
                    const newDate = format(date, 'yyyy-MM-dd');
                    if (newDate !== selectedDate) {
                      setAdditionalDates((prev) => {
                        if (prev.includes(newDate)) return prev;
                        return [...prev, newDate].sort();
                      });
                    }
                    setIsAddDatePickerOpen(false);
                  }}
                  className="mx-auto"
                />
                <p className="mt-2 text-center text-[11px] text-gray-500">
                  {loadingSameTimeEligibility
                    ? 'Checking same-time availability...'
                    : selectedCells.length > 0
                      ? 'Only dates available for the same selected time slots are clickable.'
                      : 'Select time slots first to filter dates by same-time availability.'}
                </p>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Multi-date info banner */}
      {allDatesToBook.length > 1 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="shrink-0">ℹ️</span>
          <span>
            <strong>Multi-date mode:</strong> Availability shown is for <strong>{shortDate(selectedDate)}</strong>. Selected
            slots will be added for all <strong>{allDatesToBook.length} dates</strong>:{' '}
            {allDatesToBook.map(shortDate).join(', ')}.
          </span>
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
          {notice}
        </div>
      )}

      {/* 3) Main Data Grid / Table */}
      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading schedule...</div>
      ) : allTimes.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          No time slots available for this date.
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {groupedTimes.map((group) => (
              <div key={`mobile-${group.label}`} className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-100/90 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {group.label}
                </div>

                <div className="space-y-2 p-2.5">
                  {group.times.map((time) => (
                    <div key={`mobile-time-${time}`} className="rounded-lg border border-gray-200 bg-white p-2.5">
                      <div className="mb-2.5 leading-tight">
                        <span className="text-sm font-semibold text-gray-800">
                          {to12Hour(time)} to {to12Hour(nextHour(time))}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {courts.map((court) => {
                          const slot = slotsByCourt[court.id]?.find((item) => item.time === time);
                          const available = !!slot?.available;
                          const selected = isSelected(court.id, time);
                          const conflicted = selected && isCellConflicted(court.id, time);

                          const cellBlockClass = selected
                            ? 'h-16 bg-primary text-white border-primary'
                            : available
                              ? 'h-16 bg-gray-100 border-gray-200 text-transparent hover:border-gray-500'
                              : 'h-16 bg-gray-200 text-gray-500 border-gray-300';

                          return (
                            <div key={`mobile-cell-${court.id}-${time}`} className="space-y-1">
                              <div className="text-[11px] leading-tight">
                                <p className="truncate font-semibold text-gray-700">{court.name}</p>
                                <p className="font-semibold text-primary">PHP {Number(court.hourly_rate || 0).toFixed(0)}/hr</p>
                              </div>

                              <button
                                onClick={() => toggleCell(court.id, time)}
                                disabled={!available}
                                className={[
                                  'w-full relative rounded-xl border text-xs font-medium transition-colors flex items-center justify-center overflow-hidden',
                                  cellBlockClass,
                                  !available ? 'cursor-not-allowed' : '',
                                ].join(' ')}
                              >
                                {!available && (
                                  <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
                                    <div className="w-[140%] h-[1px] bg-gray-400 rotate-[25deg] transform" />
                                    <div className="w-[140%] h-[1px] bg-gray-400 rotate-[-25deg] transform absolute" />
                                  </div>
                                )}
                                {selected ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {conflicted ? 'Conflicted' : 'Selected'}
                                  </span>
                                ) : !available ? (
                                  <span className="text-center">{slot ? 'Booked' : 'Closed'}</span>
                                ) : null}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-max min-w-full table-auto text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky left-0 z-20 border-b border-gray-200 bg-gray-50 px-2.5 py-3 text-left font-semibold text-gray-700 min-w-[140px] sm:min-w-[148px]">
                    Time Window
                  </th>
                  {courts.map((court) => (
                    <th
                      key={court.id}
                      className="border-b border-gray-200 px-2.5 py-3 text-center font-semibold text-gray-700 min-w-[118px] sm:min-w-[126px] md:min-w-[132px]"
                    >
                      <div className="flex flex-col items-center leading-tight">
                        <span>{court.name}</span>
                        <span className="text-xs font-semibold text-primary">PHP {Number(court.hourly_rate || 0).toFixed(0)}/hr</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupedTimes.map((group) => (
                  <Fragment key={group.label}>
                    <tr className="bg-gray-100/90">
                      <td
                        colSpan={courts.length + 1}
                        className="border-y border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600"
                      >
                        {group.label}
                      </td>
                    </tr>

                    {group.times.map((time) => (
                      <tr key={time} className="border-b border-gray-100 last:border-b-0">
                        <td className="sticky left-0 z-10 border-r border-gray-100 bg-white px-2.5 py-3 whitespace-nowrap min-w-[140px] sm:min-w-[148px]">
                          <div className="leading-tight">
                            <span className="font-medium text-gray-800">
                              {to12Hour(time)} to {to12Hour(nextHour(time))}
                            </span>
                          </div>
                        </td>
                        {courts.map((court) => {
                          const slot = slotsByCourt[court.id]?.find((item) => item.time === time);
                          const available = !!slot?.available;
                          const selected = isSelected(court.id, time);
                          const conflicted = selected && isCellConflicted(court.id, time);

                          const cellBlockClass = selected
                            ? 'h-16 bg-primary text-white border-primary'
                            : available
                              ? 'h-16 bg-gray-100 border-gray-200 text-transparent hover:border-gray-500'
                              : 'h-16 bg-gray-200 text-gray-500 border-gray-300';

                          return (
                            <td key={`${court.id}-${time}`} className="px-2 py-2 align-middle">
                              <button
                                onClick={() => toggleCell(court.id, time)}
                                disabled={!available}
                                className={[
                                  'w-full relative rounded-xl border text-xs font-medium transition-colors flex items-center justify-center overflow-hidden',
                                  cellBlockClass,
                                  !available ? 'cursor-not-allowed' : '',
                                ].join(' ')}
                              >
                                {!available && (
                                  <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
                                    <div className="w-[140%] h-[1px] bg-gray-400 rotate-[25deg] transform" />
                                    <div className="w-[140%] h-[1px] bg-gray-400 rotate-[-25deg] transform absolute" />
                                  </div>
                                )}
                                {selected ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {conflicted ? 'Conflicted' : 'Selected'}
                                  </span>
                                ) : !available ? (
                                  <span className="text-center">{slot ? 'Booked' : 'Closed'}</span>
                                ) : null}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Selected Slots: {selectedCells.length}
            {allDatesToBook.length > 1 && (
              <span className="text-gray-500 font-normal ml-1">
                × {allDatesToBook.length} dates = {selectedCells.length * allDatesToBook.length}{' '}
                bookings
              </span>
            )}
            {activeConflicts.length > 0 && (
              <span className="text-amber-600 font-medium ml-2">
                ({activeConflicts.length} conflicted)
              </span>
            )}
          </p>
          <p className="text-xs text-gray-600">
            Estimated subtotal:{' '}
            {allDatesToBook.length > 1 ? (
              <>
                <span className="line-through text-gray-400 mr-1">
                  ₱{(selectedTotal * allDatesToBook.length).toFixed(2)}
                </span>
                <span className="font-semibold text-gray-800">
                  ₱{accurateTotalEstimate.toFixed(2)}
                </span>
                <span className="text-gray-400 ml-1">({validSlotCount} valid slots)</span>
              </>
            ) : (
              <span>₱{accurateTotalEstimate.toFixed(2)}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {validatingConflicts && (
            <span className="text-[10px] text-gray-400 animate-pulse">Checking conflicts...</span>
          )}
          <button
            onClick={() => setSelectedCells([])}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleBookNow}
            disabled={
              selectedCells.length === 0 ||
              isBooking ||
              isChecking ||
              activeConflicts.length === selectedCells.length * allDatesToBook.length
            }
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm',
              activeConflicts.length > 0 &&
              activeConflicts.length < selectedCells.length * allDatesToBook.length
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-primary text-white hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {isChecking
              ? 'Checking...'
              : isBooking
                ? 'Booking...'
                : activeConflicts.length === selectedCells.length * allDatesToBook.length &&
                    selectedCells.length > 0
                  ? 'All Slots Conflicted'
                  : activeConflicts.length > 0
                    ? 'Review Conflicts'
                    : `Book Now (${validSlotCount} slot${validSlotCount !== 1 ? 's' : ''})`}
          </button>
        </div>
      </div>

      <Dialog open={conflictModalOpen} onOpenChange={setConflictModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <DialogTitle className="text-xl text-center">Conflict Resolution</DialogTitle>
            <DialogDescription className="text-center pt-2">
              Some selected slots are unavailable. Review the valid slots below.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">
                Unavailable Slots (Excluded):
              </p>
              <ul className="space-y-1 max-h-[140px] overflow-y-auto">
                {conflicts.map((c, i) => (
                  <li key={i} className="text-[11px] text-amber-700 flex items-center gap-2">
                    <span className="shrink-0 w-1 h-1 rounded-full bg-amber-400" />
                    <span className="font-semibold">{c.date}</span> • {to12Hour(c.startTime)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-800 mb-2">
                Valid Slots (To be Booked):
              </p>
              <p className="text-xs text-green-700 mb-3">
                Total: <span className="font-bold">{validSlotCount} sessions</span> • Subtotal:{' '}
                <span className="font-bold">₱{accurateTotalEstimate.toFixed(2)}</span>
              </p>
              <p className="text-[11px] text-green-600 italic">
                Only these slots will be added to your booking summary.
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-2">
            <button
              onClick={() => setConflictModalOpen(false)}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel / Adjust
            </button>
            <button
              onClick={() => confirmBooking(pendingCartItems, conflicts)}
              disabled={validSlotCount === 0}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              Confirm & Book Now
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
