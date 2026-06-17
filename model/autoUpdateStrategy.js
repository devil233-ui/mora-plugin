import path from 'node:path'
import fs from 'node:fs'
import YAML from 'yaml'
import RoleGuide from './roleGuide.js'
import { logger } from './setting.js'

const _path = process.cwd()

/** 配置文件路径：mora-plugin-res/strategy/config.yaml */
const STRATEGY_CONFIG_PATH = path.join(_path, 'plugins/mora-plugin/resources/mora-plugin-res/strategy/config.yaml')

/** 游戏类型映射 */
const GAME_MAP = {
  'gs': 'gs',
  '原神': 'gs',
  'sr': 'sr',
  '星铁': 'sr',
  'zzz': 'zzz',
  '绝区零': 'zzz'
}

/** 游戏名称（日志用） */
const GAME_NAMES = {
  'gs': '原神',
  'sr': '星铁',
  'zzz': '绝区零'
}

/**
 * 自动更新攻略核心逻辑
 */
class autoUpdateStrategyModel {
  /**
   * 读取配置文件
   * @returns {object|null}
   */
  loadConfig () {
    if (!fs.existsSync(STRATEGY_CONFIG_PATH)) {
      logger.mark('[自动更新攻略] 未找到配置文件 mora-plugin-res/strategy/config.yaml，跳过定时任务注册')
      logger.mark('[自动更新攻略] 请在 mora-plugin-res 仓库中创建 strategy/config.yaml 文件')
      return null
    }

    try {
      const raw = fs.readFileSync(STRATEGY_CONFIG_PATH, 'utf8')
      const config = YAML.parse(raw)

      if (!config || !config.cron) {
        logger.mark('[自动更新攻略] 配置文件中未设置 cron 字段，跳过定时任务注册')
        return null
      }

      return config
    } catch (err) {
      logger.error(`[自动更新攻略] 读取配置文件失败: ${err.message}`)
      return null
    }
  }

  /**
   * 按游戏分组格式解析角色列表 → [{game, name}]
   * 格式: { gs: [胡桃, 钟离], sr: [流萤], zzz: [艾莲] }
   * @param {object} roles
   * @returns {Array<{game: string, name: string}>}
   */
  parseRoles (roles) {
    if (!roles || typeof roles !== 'object' || Array.isArray(roles)) return []

    const result = []
    for (const [gameKey, names] of Object.entries(roles)) {
      const game = GAME_MAP[gameKey]
      if (!game) {
        logger.mark(`[自动更新攻略] 未知游戏类型: ${gameKey}，跳过`)
        continue
      }
      if (!Array.isArray(names)) continue
      for (const name of names) {
        if (name && typeof name === 'string' && name.trim()) {
          result.push({ game, name: name.trim() })
        }
      }
    }
    return result
  }

  /**
   * 批量更新入口：重新读取配置并更新所有角色
   */
  async runUpdate () {
    if (!fs.existsSync(STRATEGY_CONFIG_PATH)) {
      logger.mark('[自动更新攻略] 配置文件不存在，跳过本次更新')
      return
    }

    let config
    try {
      const raw = fs.readFileSync(STRATEGY_CONFIG_PATH, 'utf8')
      config = YAML.parse(raw)
    } catch (err) {
      logger.error(`[自动更新攻略] 读取配置文件失败: ${err.message}`)
      return
    }

    const roles = this.parseRoles(config.roles || {})
    if (roles.length === 0) {
      logger.mark('[自动更新攻略] 配置文件中无有效角色，跳过本次更新')
      return
    }

    logger.mark(
      `[自动更新攻略] 开始执行定时更新，共 ${roles.length} 个角色: ` +
      roles.map(r => `${GAME_NAMES[r.game] || r.game}/${r.name}`).join(', ')
    )

    let successCount = 0
    let failCount = 0

    for (let i = 0; i < roles.length; i++) {
      const { game, name } = roles[i]

      try {
        const ok = await this._updateSingleRole(game, name)
        ok ? successCount++ : failCount++
      } catch (err) {
        logger.error(`[自动更新攻略] 更新 ${GAME_NAMES[game] || game}/${name} 异常: ${err.message}`)
        failCount++
      }

      // 角色间间隔 5 秒，避免请求过于密集
      if (i < roles.length - 1) {
        await this._sleep(5000)
      }
    }

    logger.mark(
      `[自动更新攻略] 定时更新执行完毕，成功 ${successCount} 个，失败 ${failCount} 个`
    )
  }

  /**
   * 更新单个角色攻略
   * @param {string} game  游戏类型 (gs/sr/zzz)
   * @param {string} name  角色名
   * @returns {Promise<boolean>}
   */
  async _updateSingleRole (game, name) {
    const fakeE = {
      game,
      reply: () => Promise.resolve(true),
      logFnc: `[自动更新攻略][${game}][${name}]`
    }

    const guide = new RoleGuide(fakeE)

    // 重写 replyStrategies：只记日志，不发消息
    guide.replyStrategies = async (msg, roleName) => {
      if (!msg || msg.length === 0) {
        logger.mark(`[自动更新攻略][${game}][${roleName}] 暂无攻略数据或更新失败`)
        return false
      }
      logger.mark(`[自动更新攻略][${game}][${roleName}] 攻略已更新 (${msg.length} 项)`)
      return true
    }

    try {
      let result
      if (game === 'sr') {
        result = await guide.srStrategies(name, true)
      } else if (game === 'zzz') {
        result = await guide.zzzStrategies(name, true)
      } else {
        result = await guide.strategies(name, true)
      }
      return result !== false
    } catch (err) {
      logger.error(`[自动更新攻略][${game}][${name}] 执行异常: ${err.message}`)
      return false
    }
  }

  _sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export default new autoUpdateStrategyModel()
