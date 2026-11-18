/**
 * The row under the picture, as phone players have it: danmaku on or off,
 * how they show and the show's quality behind one settings button, and full
 * screen with the danmaku kept on top.
 */
import { AREAS, OPACITIES, SIZES } from './danmaku-layer.js'
import { Icon, Popover, React, fill, h, qualityLabel } from './ui.js'

/** One choice among a few, as chips. */
function Choice({ label, options, value, onChange }) {
  return h('div', { className: 'vsync-setting' },
    h('span', { className: 'vsync-settingLabel' }, label),
    h('div', { className: 'vsync-settingChoices', role: 'group', 'aria-label': label }, options.map(option => h('button', {
      key: option.value,
      type: 'button',
      className: 'vsync-chip',
      'aria-pressed': String(option.value === value),
      onClick: () => onChange(option.value),
    }, option.label))))
}

const percent = value => `${Math.round(value * 100)}%`
/** The words for AREAS, in its order. */
const AREA_WORDS = Object.freeze(['quarter', 'half', 'full'])

/**
 * @param {object} props
 * @param {{ on: boolean, opacity: number, area: number, size: string }} props.settings - this viewer's danmaku settings
 * @param {(patch: object) => void} props.onSettings
 * @param {boolean} props.danmaku - whether the show's source has danmaku
 * @param {number | null} props.count - how many the episode has, once known
 * @param {{ value: string, choices: string[], onChange: (quality: string) => void, busy: boolean } | null} props.quality
 * @param {boolean} props.full - whether the player fills the screen
 * @param {() => void} props.onFull
 */
export function PlayerBar({ t, settings, onSettings, danmaku, count, quality, full, onFull }) {
  const danmakuSettings = danmaku && settings.on && [
    h(Choice, { key: 'opacity', label: t('danmaku.opacity'), value: settings.opacity, onChange: opacity => onSettings({ opacity }), options: OPACITIES.map(value => ({ value, label: percent(value) })) }),
    h(Choice, { key: 'area', label: t('danmaku.area'), value: settings.area, onChange: area => onSettings({ area }), options: AREAS.map((value, n) => ({ value, label: t(`danmaku.area.${AREA_WORDS[n]}`) })) }),
    h(Choice, { key: 'size', label: t('danmaku.size'), value: settings.size, onChange: size => onSettings({ size }), options: SIZES.map(value => ({ value, label: t(`danmaku.size.${value}`) })) }),
  ]
  const qualityChoice = quality !== null && h('div', { key: 'quality', className: 'vsync-settingGroup' },
    h(Choice, { label: t('quality.label'), value: quality.value, onChange: quality.onChange, options: quality.choices.map(value => ({ value, label: qualityLabel(t, value) })) }),
    h('p', { className: 'vsync-settingNote' }, quality.busy ? t('quality.changing') : t('quality.fromNext')))
  const hasSettings = Boolean(danmakuSettings) || Boolean(qualityChoice)
  return h('div', { className: 'vsync-playerBar' },
    danmaku && h('button', {
      type: 'button',
      className: 'vsync-btn vsync-danmakuToggle',
      role: 'switch',
      'aria-checked': String(settings.on),
      onClick: () => onSettings({ on: !settings.on }),
    }, h(Icon.Danmaku), settings.on && count !== null ? fill(t('danmaku.count'), { n: count }) : t('danmaku.label')),
    h('span', { className: 'vsync-grow' }),
    hasSettings && h(Popover, { label: t('player.settings'), icon: h(Icon.Settings) }, danmakuSettings, qualityChoice),
    h('button', { type: 'button', className: 'vsync-icon', 'aria-label': t(full ? 'player.exitFull' : 'player.full'), title: t(full ? 'player.exitFull' : 'player.full'), 'aria-pressed': String(full), onClick: onFull }, h(full ? Icon.Shrink : Icon.Expand)))
}
