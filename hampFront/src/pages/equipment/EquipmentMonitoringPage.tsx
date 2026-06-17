import { equipmentStatus } from '../../data/mockData'

export function EquipmentMonitoringPage() {
  return (
    <section className="equipmentGrid">
      {equipmentStatus.map((equipment) => (
        <article key={equipment.code} className={`equipmentCard ${equipment.tone}`}>
          <div>
            <span>{equipment.code}</span>
            <h2>{equipment.name}</h2>
          </div>
          <strong>{equipment.status}</strong>
          <small>가동률 {equipment.rate}</small>
        </article>
      ))}
    </section>
  )
}
