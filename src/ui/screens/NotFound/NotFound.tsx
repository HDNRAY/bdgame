import { Link } from 'react-router-dom'
import './NotFound.scss'

/** 未知路径 404 兜底：GH Pages 深链未匹配路由时显示，带返回首页链接 */
export function NotFound() {
    return (
        <div className="not-found">
            <div className="not-found-title">404</div>
            <div className="not-found-desc">页面不存在或已被移动</div>
            <Link className="not-found-link" to="/">
                返回首页
            </Link>
        </div>
    )
}
