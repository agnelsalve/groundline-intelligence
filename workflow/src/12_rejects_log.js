// Rejects log — every record that did not make the dataset, and why.
// Makes the filter auditable: anyone can check nothing good was thrown away.
return $input.all()
  .map((i) => i.json)
  .filter((j) => j._type === 'record' && j._status !== 'kept')
  .map((j) => ({ json: {
    record_id: j.record_id,
    status: j._status,
    reason: j._reason_detail,
    published_date: j.published_date,
    title: j.title,
    source_name: j.source_name,
    collected_via: j.collected_via,
    url: j.url,
  }}));
