import plugin from '../../../lib/plugins/plugin.js'
import autoUpdateStrategyModel from '../model/autoUpdateStrategy.js'

/**
 * 定时自动更新指定角色的攻略图片
 * 配置文件位于 resources/mora-plugin-res/strategy/config.yaml
 */
export class autoUpdateStrategy extends plugin {
  constructor () {
    super({
      name: '摩拉自动更新攻略',
      dsc: '定时自动更新指定角色攻略',
      event: 'message',
      priority: 7000,
      rule: []
    })

    this._initTask()
  }

  /** 注册定时任务 */
  _initTask () {
    try {
      const config = autoUpdateStrategyModel.loadConfig()
      if (!config) return

      const roles = autoUpdateStrategyModel.parseRoles(config.roles || {})
      if (roles.length === 0) {
        logger.mark('[自动更新攻略] 配置文件中没有有效的角色，跳过定时任务注册')
        return
      }

      this.task = {
        name: '[摩拉自动更新攻略]',
        cron: config.cron,
        fnc: () => autoUpdateStrategyModel.runUpdate()
      }

      const GAME_NAMES = { gs: '原神', sr: '星铁', zzz: '绝区零' }
      logger.mark(
        `[自动更新攻略] 已注册定时任务，cron: ${config.cron}，` +
        `角色: ${roles.map(r => `${GAME_NAMES[r.game] || r.game}-${r.name}`).join('、')}`
      )
    } catch (err) {
      logger.error(`[自动更新攻略] 初始化定时任务失败: ${err.message}`)
    }
  }
}
