import { Button } from '../Button/Button'
import './ConfirmDialog.scss'

interface ConfirmDialogProps {
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    onConfirm: () => void
    onCancel: () => void
    isDanger?: boolean
}

export function ConfirmDialog({
    title,
    message,
    confirmText = '确定',
    cancelText = '取消',
    onConfirm,
    onCancel,
    isDanger = false,
}: ConfirmDialogProps) {
    return (
        <div className="confirm-dialog-overlay" onClick={onCancel}>
            <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-dialog-title">{title}</div>
                <div className="confirm-dialog-message">{message}</div>
                <div className="confirm-dialog-buttons">
                    <Button variant="plain" size="md" className="confirm-dialog-btn confirm-dialog-cancel" onClick={onCancel}>
                        {cancelText}
                    </Button>
                    <Button
                        variant="plain"
                        size="md"
                        className={`confirm-dialog-btn confirm-dialog-confirm${isDanger ? ' confirm-dialog-danger' : ''}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    )
}
