'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Calendar, Percent, Users, Clock, Gift } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getVenueDiscountRules,
  getVenueHolidayPricing,
  createDiscountRule,
  updateDiscountRule,
  deleteDiscountRule,
  toggleDiscountRule,
  createHolidayPricing,
  updateHolidayPricing,
  deleteHolidayPricing,
  toggleHolidayPricing,
  type DiscountRule,
  type HolidayPricing,
  type DiscountType,
} from '@/app/actions/discount-actions';

interface DiscountManagementProps {
  venueId: string;
}

export default function DiscountManagement({ venueId }: DiscountManagementProps) {
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([]);
  const [holidayPricing, setHolidayPricing] = useState<HolidayPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [editingRule, setEditingRule] = useState<DiscountRule | null>(null);
  const [editingHoliday, setEditingHoliday] = useState<HolidayPricing | null>(null);
  const { toast } = useToast();

  // Discount Rule Form State
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    discount_type: 'multi_day' as DiscountType,
    discount_value: 0,
    discount_unit: 'percent' as 'percent' | 'fixed',
    min_days: null as number | null,
    min_players: null as number | null,
    advance_days: null as number | null,
    is_active: true,
    priority: 50,
    valid_from: null as string | null,
    valid_until: null as string | null,
  });

  // Holiday Pricing Form State
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    price_multiplier: 1.0,
    fixed_surcharge: null as number | null,
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, [venueId]);

  const loadData = async () => {
    setLoading(true);
    const [rulesResult, pricingResult] = await Promise.all([
      getVenueDiscountRules(venueId),
      getVenueHolidayPricing(venueId),
    ]);

    if (rulesResult.success) {
      setDiscountRules(rulesResult.data);
    }
    if (pricingResult.success) {
      setHolidayPricing(pricingResult.data);
    }
    setLoading(false);
  };

  // ==========================================
  // DISCOUNT RULES HANDLERS
  // ==========================================

  const handleOpenRuleModal = (rule?: DiscountRule) => {
    if (rule) {
      setEditingRule(rule);
      setRuleForm({
        name: rule.name,
        description: rule.description || '',
        discount_type: rule.discount_type,
        discount_value: rule.discount_value,
        discount_unit: rule.discount_unit,
        min_days: rule.min_days,
        min_players: rule.min_players,
        advance_days: rule.advance_days,
        is_active: rule.is_active,
        priority: rule.priority,
        valid_from: rule.valid_from,
        valid_until: rule.valid_until,
      });
    } else {
      setEditingRule(null);
      setRuleForm({
        name: '',
        description: '',
        discount_type: 'multi_day',
        discount_value: 0,
        discount_unit: 'percent',
        min_days: null,
        min_players: null,
        advance_days: null,
        is_active: true,
        priority: 50,
        valid_from: null,
        valid_until: null,
      });
    }
    setShowRuleModal(true);
  };

  const handleSaveRule = async () => {
    try {
      if (!ruleForm.name || ruleForm.discount_value <= 0) {
        toast({
          title: 'Validation Error',
          description: 'Please fill in all required fields',
          variant: 'destructive',
        });
        return;
      }

      if (editingRule) {
        const result = await updateDiscountRule(editingRule.id, ruleForm);
        if (result.success) {
          toast({
            title: 'Success',
            description: 'Discount rule updated successfully',
          });
          loadData();
          setShowRuleModal(false);
        } else {
          throw new Error(result.error);
        }
      } else {
        const result = await createDiscountRule(venueId, ruleForm);
        if (result.success) {
          toast({
            title: 'Success',
            description: 'Discount rule created successfully',
          });
          loadData();
          setShowRuleModal(false);
        } else {
          throw new Error(result.error);
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save discount rule',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this discount rule?')) return;

    try {
      const result = await deleteDiscountRule(ruleId);
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Discount rule deleted successfully',
        });
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete discount rule',
        variant: 'destructive',
      });
    }
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      const result = await toggleDiscountRule(ruleId, isActive);
      if (result.success) {
        toast({
          title: 'Success',
          description: `Discount rule ${isActive ? 'enabled' : 'disabled'} successfully`,
        });
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to toggle discount rule',
        variant: 'destructive',
      });
    }
  };

  // ==========================================
  // HOLIDAY PRICING HANDLERS
  // ==========================================

  const handleOpenHolidayModal = (holiday?: HolidayPricing) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setHolidayForm({
        name: holiday.name,
        start_date: holiday.start_date,
        end_date: holiday.end_date,
        price_multiplier: holiday.price_multiplier,
        fixed_surcharge: holiday.fixed_surcharge,
        is_active: holiday.is_active,
      });
    } else {
      setEditingHoliday(null);
      setHolidayForm({
        name: '',
        start_date: '',
        end_date: '',
        price_multiplier: 1.0,
        fixed_surcharge: null,
        is_active: true,
      });
    }
    setShowHolidayModal(true);
  };

  const handleSaveHoliday = async () => {
    try {
      if (!holidayForm.name || !holidayForm.start_date || !holidayForm.end_date) {
        toast({
          title: 'Validation Error',
          description: 'Please fill in all required fields',
          variant: 'destructive',
        });
        return;
      }

      if (editingHoliday) {
        const result = await updateHolidayPricing(editingHoliday.id, holidayForm);
        if (result.success) {
          toast({
            title: 'Success',
            description: 'Holiday pricing updated successfully',
          });
          loadData();
          setShowHolidayModal(false);
        } else {
          throw new Error(result.error);
        }
      } else {
        const result = await createHolidayPricing(venueId, holidayForm);
        if (result.success) {
          toast({
            title: 'Success',
            description: 'Holiday pricing created successfully',
          });
          loadData();
          setShowHolidayModal(false);
        } else {
          throw new Error(result.error);
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save holiday pricing',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    if (!confirm('Are you sure you want to delete this holiday pricing?')) return;

    try {
      const result = await deleteHolidayPricing(holidayId);
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Holiday pricing deleted successfully',
        });
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete holiday pricing',
        variant: 'destructive',
      });
    }
  };

  const handleToggleHoliday = async (holidayId: string, isActive: boolean) => {
    try {
      const result = await toggleHolidayPricing(holidayId, isActive);
      if (result.success) {
        toast({
          title: 'Success',
          description: `Holiday pricing ${isActive ? 'enabled' : 'disabled'} successfully`,
        });
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to toggle holiday pricing',
        variant: 'destructive',
      });
    }
  };

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  const getDiscountTypeIcon = (type: DiscountType) => {
    switch (type) {
      case 'multi_day':
        return <Calendar className="h-4 w-4" />;
      case 'group':
        return <Users className="h-4 w-4" />;
      case 'early_bird':
        return <Clock className="h-4 w-4" />;
      case 'seasonal':
        return <Gift className="h-4 w-4" />;
      default:
        return <Percent className="h-4 w-4" />;
    }
  };

  const getDiscountTypeLabel = (type: DiscountType) => {
    switch (type) {
      case 'multi_day':
        return 'Multi-Day Booking';
      case 'group':
        return 'Group Booking';
      case 'early_bird':
        return 'Early Bird Special';
      case 'seasonal':
        return 'Seasonal Discount';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading discounts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="rules" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rules">
            Discount Rules ({discountRules.length})
          </TabsTrigger>
          <TabsTrigger value="holidays">
            Holiday Pricing ({holidayPricing.length})
          </TabsTrigger>
        </TabsList>

        {/* DISCOUNT RULES TAB */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Discount Rules</h3>
              <p className="text-sm text-muted-foreground">
                Create discount rules for multi-day bookings, groups, and early birds
              </p>
            </div>
            <Button onClick={() => handleOpenRuleModal()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Discount Rule
            </Button>
          </div>

          {discountRules.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8">
                <Percent className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No discount rules yet. Create your first rule to start offering discounts!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {discountRules.map((rule) => (
                <Card key={rule.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {getDiscountTypeIcon(rule.discount_type)}
                          <CardTitle className="text-base">{rule.name}</CardTitle>
                        </div>
                        <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline">
                          {getDiscountTypeLabel(rule.discount_type)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenRuleModal(rule)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {rule.description && (
                      <CardDescription>{rule.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Discount:</span>
                        <p className="font-medium">
                          {rule.discount_value}
                          {rule.discount_unit === 'percent' ? '%' : ' PHP'}
                        </p>
                      </div>
                      {rule.min_days && (
                        <div>
                          <span className="text-muted-foreground">Min Days:</span>
                          <p className="font-medium">{rule.min_days}</p>
                        </div>
                      )}
                      {rule.min_players && (
                        <div>
                          <span className="text-muted-foreground">Min Players:</span>
                          <p className="font-medium">{rule.min_players}</p>
                        </div>
                      )}
                      {rule.advance_days && (
                        <div>
                          <span className="text-muted-foreground">Book Ahead:</span>
                          <p className="font-medium">{rule.advance_days} days</p>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Priority:</span>
                        <p className="font-medium">{rule.priority}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* HOLIDAY PRICING TAB */}
        <TabsContent value="holidays" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Holiday & Seasonal Pricing</h3>
              <p className="text-sm text-muted-foreground">
                Set special pricing for holidays, peak seasons, or off-season periods
              </p>
            </div>
            <Button onClick={() => handleOpenHolidayModal()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Holiday Pricing
            </Button>
          </div>

          {holidayPricing.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No holiday pricing set. Add special pricing for holidays or seasonal periods!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {holidayPricing.map((holiday) => {
                const isIncrease = holiday.price_multiplier > 1.0;
                const percentChange = Math.abs((holiday.price_multiplier - 1.0) * 100);

                return (
                  <Card key={holiday.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <CardTitle className="text-base">{holiday.name}</CardTitle>
                          </div>
                          <Badge variant={holiday.is_active ? 'default' : 'secondary'}>
                            {holiday.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge
                            variant={isIncrease ? 'destructive' : 'default'}
                          >
                            {isIncrease ? `+${percentChange.toFixed(0)}%` : `-${percentChange.toFixed(0)}%`}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={holiday.is_active}
                            onCheckedChange={(checked) => handleToggleHoliday(holiday.id, checked)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenHolidayModal(holiday)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteHoliday(holiday.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Start Date:</span>
                          <p className="font-medium">
                            {new Date(holiday.start_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">End Date:</span>
                          <p className="font-medium">
                            {new Date(holiday.end_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Multiplier:</span>
                          <p className="font-medium">{holiday.price_multiplier}x</p>
                        </div>
                        {holiday.fixed_surcharge && (
                          <div>
                            <span className="text-muted-foreground">Fixed Surcharge:</span>
                            <p className="font-medium">₱{holiday.fixed_surcharge}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* DISCOUNT RULE MODAL */}
      <Dialog open={showRuleModal} onOpenChange={setShowRuleModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Discount Rule' : 'Create Discount Rule'}
            </DialogTitle>
            <DialogDescription>
              Configure discount rules for different booking scenarios
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule-name">Rule Name *</Label>
                <Input
                  id="rule-name"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder="e.g., Weekend Warrior Special"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-type">Discount Type *</Label>
                <Select
                  value={ruleForm.discount_type}
                  onValueChange={(value) =>
                    setRuleForm({ ...ruleForm, discount_type: value as DiscountType })
                  }
                >
                  <SelectTrigger id="rule-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multi_day">Multi-Day Booking</SelectItem>
                    <SelectItem value="group">Group Booking</SelectItem>
                    <SelectItem value="early_bird">Early Bird Special</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-description">Description</Label>
              <Textarea
                id="rule-description"
                value={ruleForm.description}
                onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                placeholder="Brief description of this discount"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount-value">Discount Value *</Label>
                <Input
                  id="discount-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={ruleForm.discount_value}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, discount_value: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount-unit">Unit *</Label>
                <Select
                  value={ruleForm.discount_unit}
                  onValueChange={(value) =>
                    setRuleForm({ ...ruleForm, discount_unit: value as 'percent' | 'fixed' })
                  }
                >
                  <SelectTrigger id="discount-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (₱)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Type-specific fields */}
            {ruleForm.discount_type === 'multi_day' && (
              <div className="space-y-2">
                <Label htmlFor="min-days">Minimum Days Required</Label>
                <Input
                  id="min-days"
                  type="number"
                  min="1"
                  value={ruleForm.min_days || ''}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, min_days: parseInt(e.target.value) || null })
                  }
                  placeholder="e.g., 3"
                />
              </div>
            )}

            {ruleForm.discount_type === 'group' && (
              <div className="space-y-2">
                <Label htmlFor="min-players">Minimum Players Required</Label>
                <Input
                  id="min-players"
                  type="number"
                  min="1"
                  value={ruleForm.min_players || ''}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, min_players: parseInt(e.target.value) || null })
                  }
                  placeholder="e.g., 4"
                />
              </div>
            )}

            {ruleForm.discount_type === 'early_bird' && (
              <div className="space-y-2">
                <Label htmlFor="advance-days">Book Ahead (Days)</Label>
                <Input
                  id="advance-days"
                  type="number"
                  min="1"
                  value={ruleForm.advance_days || ''}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, advance_days: parseInt(e.target.value) || null })
                  }
                  placeholder="e.g., 7"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valid-from">Valid From (Optional)</Label>
                <Input
                  id="valid-from"
                  type="date"
                  value={ruleForm.valid_from || ''}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, valid_from: e.target.value || null })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid-until">Valid Until (Optional)</Label>
                <Input
                  id="valid-until"
                  type="date"
                  value={ruleForm.valid_until || ''}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, valid_until: e.target.value || null })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority (Higher = Applied First)</Label>
              <Input
                id="priority"
                type="number"
                min="0"
                max="100"
                value={ruleForm.priority}
                onChange={(e) =>
                  setRuleForm({ ...ruleForm, priority: parseInt(e.target.value) || 50 })
                }
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="rule-active"
                checked={ruleForm.is_active}
                onCheckedChange={(checked) => setRuleForm({ ...ruleForm, is_active: checked })}
              />
              <Label htmlFor="rule-active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRuleModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule}>
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HOLIDAY PRICING MODAL */}
      <Dialog open={showHolidayModal} onOpenChange={setShowHolidayModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingHoliday ? 'Edit Holiday Pricing' : 'Create Holiday Pricing'}
            </DialogTitle>
            <DialogDescription>
              Set special pricing for holidays or seasonal periods
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="holiday-name">Name *</Label>
              <Input
                id="holiday-name"
                value={holidayForm.name}
                onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                placeholder="e.g., Christmas Holiday Surcharge"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date *</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={holidayForm.start_date}
                  onChange={(e) =>
                    setHolidayForm({ ...holidayForm, start_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date *</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={holidayForm.end_date}
                  onChange={(e) =>
                    setHolidayForm({ ...holidayForm, end_date: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price-multiplier">
                Price Multiplier (e.g., 1.3 = 30% increase, 0.8 = 20% discount)
              </Label>
              <Input
                id="price-multiplier"
                type="number"
                min="0"
                step="0.01"
                value={holidayForm.price_multiplier}
                onChange={(e) =>
                  setHolidayForm({
                    ...holidayForm,
                    price_multiplier: parseFloat(e.target.value) || 1.0,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fixed-surcharge">
                OR Fixed Surcharge (Optional - overrides multiplier)
              </Label>
              <Input
                id="fixed-surcharge"
                type="number"
                min="0"
                step="0.01"
                value={holidayForm.fixed_surcharge || ''}
                onChange={(e) =>
                  setHolidayForm({
                    ...holidayForm,
                    fixed_surcharge: parseFloat(e.target.value) || null,
                  })
                }
                placeholder="₱ amount"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="holiday-active"
                checked={holidayForm.is_active}
                onCheckedChange={(checked) =>
                  setHolidayForm({ ...holidayForm, is_active: checked })
                }
              />
              <Label htmlFor="holiday-active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHolidayModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveHoliday}>
              {editingHoliday ? 'Update Pricing' : 'Create Pricing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
