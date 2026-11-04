// app/dashboard/components/today/index.js
// The Today theme's views (lib/uiThemes.js → 'today'): one model, three screens.
export { default as TodayView } from './TodayView';
export { default as PipelineView } from './PipelineView';
export { default as CockpitView } from './CockpitView';
export { useTodayData } from './useTodayData';
export { buildTodayModel, STAGES } from './todayModel';
