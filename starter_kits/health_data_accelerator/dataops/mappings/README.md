# DMS Table Mapping Examples

These files are **optional alternative examples** of DMS table mapping configurations for different healthcare data source tables (patients, vitals, surveys, organizations).

They are **not deployed by default**. The default deployment uses the mapping defined inline in `../dms.yaml`.

To use one of these mappings instead, update the `dms` module in `mdaa.yaml` to reference it:

```yaml
dms:
  module_path: "@aws-mdaa/dataops-dms"
  module_configs:
    - ./dataops/mappings/patients_mappings.yaml
```
