/** Persist the policy inside the artifact, independent of launcher environment or user settings. */
function distributionMetadata(env) {
  if (env.ORCA_MANUAL_UPDATES === undefined) {
    return {}
  }
  if (env.ORCA_MANUAL_UPDATES !== '1') {
    throw new Error('ORCA_MANUAL_UPDATES must be 1 or unset')
  }
  return { orcaDistribution: { repository: 'anubischpr/massorca', updatePolicy: 'manual' } }
}

module.exports = { distributionMetadata }
