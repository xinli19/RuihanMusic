from django.db import migrations

def forwards(apps, schema_editor):
    Student = apps.get_model('students', 'Student')
    for s in Student.objects.all():
        changed = False
        if (not getattr(s, 'research_note', None)) and getattr(s, 'research_notes', None):
            s.research_note = s.research_notes
            changed = True
        if (not getattr(s, 'ops_note', None)) and getattr(s, 'operation_notes', None):
            s.ops_note = s.operation_notes
            changed = True
        if changed:
            s.save(update_fields=['research_note', 'ops_note'])

def backwards(apps, schema_editor):
    Student = apps.get_model('students', 'Student')
    for s in Student.objects.all():
        changed = False
        if getattr(s, 'research_note', None) and not getattr(s, 'research_notes', None):
            s.research_notes = s.research_note
            changed = True
        if getattr(s, 'ops_note', None) and not getattr(s, 'operation_notes', None):
            s.operation_notes = s.ops_note
            changed = True
        if changed:
            s.save(update_fields=['research_notes', 'operation_notes'])

class Migration(migrations.Migration):

    dependencies = [
        ('students', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]