import styles from './Progress.module.css'

function Progress({ done }) {

	return (
		// <div className={styles.progress}>
		// 	<div className={styles.progress_done} style={{
		// 		opacity: 1,
		// 		width: `${done}%`
		// 	}}>
		// 		{done}%
		// 	</div>
		// </div>
		<div className="w-full bg-gray-200 rounded-full">
			<div className="bg-primary text-xs font-medium text-blue-100 text-center p-0.5 leading-none rounded-full" style={{
				width: `${done}%`
			}}> {done}%</div>
		</div>
	)
}

export default Progress